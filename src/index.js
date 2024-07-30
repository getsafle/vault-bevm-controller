
const { EventEmitter } = require('events')
const log = require('loglevel')

const bip39 = require('bip39')
const ObservableStore = require('obs-store')
const encryptor = require('browser-passworder')
const { normalize: normalizeAddress } = require('eth-sig-util')

const SimpleKeyring = require('eth-simple-keyring')
const HdKeyring = require('eth-hd-keyring')

const keyringTypes = [
    SimpleKeyring,
    HdKeyring,
]

class KeyringController extends EventEmitter {

    //
    // PUBLIC METHODS
    //

    constructor(opts) {
        super()
        const initState = opts.initState || {}
        this.keyringTypes = opts.keyringTypes ? keyringTypes.concat(opts.keyringTypes) : keyringTypes
        this.store = new ObservableStore(initState)
        this.memStore = new ObservableStore({
            isUnlocked: false,
            keyringTypes: this.keyringTypes.map((krt) => krt.type),
            keyrings: [],
        })

        this.encryptor = opts.encryptor || encryptor
        this.keyrings = []
        this.getNetwork = opts.getNetwork
        this.importedWallets = []
    }

    /**
     * Full Update
     *
     * Emits the `update` event and @returns a Promise that resolves to
     * the current state.
     *
     * Frequently used to end asynchronous chains in this class,
     * indicating consumers can often either listen for updates,
     * or accept a state-resolving promise to consume their results.
     *
     * @returns {Object} The controller state.
     */
    fullUpdate() {
        this.emit('update', this.memStore.getState())
        return this.memStore.getState()
    }

    /**
     * Create New Vault And Keychain
     *
     * Destroys any old encrypted storage,
     * creates a new encrypted store with the given password,
     * randomly creates a new HD wallet with 1 account,
     * faucets that account on the testnet.
     *
     * @emits KeyringController#unlock
     * @param {string} password - The password to encrypt the vault with.
     * @returns {Promise<Object>} A Promise that resolves to the state.
     */
    createNewVaultAndKeychain(password) {
        return this.persistAllKeyrings(password)
            .then(this.createFirstKeyTree.bind(this))
            .then(this.persistAllKeyrings.bind(this, password))
            .then(this.setUnlocked.bind(this))
            .then(this.fullUpdate.bind(this))
    }

    /**
     * CreateNewVaultAndRestore
     *
     * Destroys any old encrypted storage,
     * creates a new encrypted store with the given password,
     * creates a new HD wallet from the given seed with 1 account.
     *
     * @emits KeyringController#unlock
     * @param {string} password - The password to encrypt the vault with
     * @param {string} seed - The BIP44-compliant seed phrase.
     * @returns {Promise<Object>} A Promise that resolves to the state.
     */
    createNewVaultAndRestore(password, seed) {
        if (typeof password !== 'string') {
            return Promise.reject(new Error('Password must be text.'))
        }

        if (!bip39.validateMnemonic(seed)) {
            return Promise.reject(new Error('Seed phrase is invalid.'))
        }

        this.clearKeyrings()

        return this.persistAllKeyrings(password)
            .then(() => {
                return this.addNewKeyring('HD Key Tree', {
                    mnemonic: seed,
                    numberOfAccounts: 1,
                })
            })
            .then((firstKeyring) => {
                return firstKeyring.getAccounts()
            })
            .then(([firstAccount]) => {
                if (!firstAccount) {
                    throw new Error('KeyringController - First Account not found.')
                }
                return null
            })
            .then(this.persistAllKeyrings.bind(this, password))
            .then(this.setUnlocked.bind(this))
            .then(this.fullUpdate.bind(this))
    }

    /**
     * Add New Keyring
     *
     * Adds a new Keyring of the given `type` to the vault
     * and the current decrypted Keyrings array.
     *
     * All Keyring classes implement a unique `type` string,
     * and this is used to retrieve them from the keyringTypes array.
     *
     * @param {string} type - The type of keyring to add.
     * @param {Object} opts - The constructor options for the keyring.
     * @returns {Promise<Keyring>} The new keyring.
     */
    addNewKeyring(type, opts) {
        const Keyring = this.getKeyringClassForType(type)
        const keyring = new Keyring(opts)
        return keyring.getAccounts()
            .then((accounts) => {
                return this.checkForDuplicate(type, accounts)
            })
            .then(() => {
                this.keyrings.push(keyring)
                return this.persistAllKeyrings()
            })
            .then(() => this._updateMemStoreKeyrings())
            .then(() => this.fullUpdate())
            .then(() => {
                return keyring
            })
    }

    //
    // PRIVATE METHODS
    //

    /**
     * Create First Key Tree
     *
     * - Clears the existing vault
     * - Creates a new vault
     * - Creates a random new HD Keyring with 1 account
     * - Makes that account the selected account
     * - Faucets that account on testnet
     * - Puts the current seed words into the state tree
     *
     * @returns {Promise<void>} - A promise that resovles if the operation was successful.
     */
    createFirstKeyTree() {
        this.clearKeyrings()
        return this.addNewKeyring('HD Key Tree', { numberOfAccounts: 1 })
            .then((keyring) => {
                return keyring.getAccounts()
            })
            .then(([firstAccount]) => {
                if (!firstAccount) {
                    throw new Error('KeyringController - No account found on keychain.')
                }
                const hexAccount = normalizeAddress(firstAccount)
                this.emit('newVault', hexAccount)
                return null
            })
    }

    /**
     * Persist All Keyrings
     *
     * Iterates the current `keyrings` array,
     * serializes each one into a serialized array,
     * encrypts that array with the provided `password`,
     * and persists that encrypted string to storage.
     *
     * @param {string} password - The keyring controller password.
     * @returns {Promise<boolean>} Resolves to true once keyrings are persisted.
     */
    persistAllKeyrings(password = this.password) {
        if (typeof password !== 'string') {
            return Promise.reject(new Error(
                'KeyringController - password is not a string',
            ))
        }

        this.password = password
        return Promise.all(this.keyrings.map((keyring) => {
            return Promise.all([keyring.type, keyring.serialize()])
                .then((serializedKeyringArray) => {
                    // Label the output values on each serialized Keyring:
                    return {
                        type: serializedKeyringArray[0],
                        data: serializedKeyringArray[1],
                    }
                })
        }))
            .then((serializedKeyrings) => {
                return this.encryptor.encrypt(this.password, serializedKeyrings)
            })
            .then((encryptedString) => {
                this.store.updateState({ vault: encryptedString })
                return true
            })
    }

    getKeyringClassForType(type) {
        return this.keyringTypes.find((kr) => kr.type === type)
    }

    /**
     * Get Keyrings by Type
     *
     * Gets all keyrings of the given type.
     *
     * @param {string} type - The keyring types to retrieve.
     * @returns {Array<Keyring>} The keyrings.
     */
    getKeyringsByType(type) {
        return this.keyrings.filter((keyring) => keyring.type === type)
    }

    getKeyringForAccount(address) {
        const hexed = normalizeAddress(address)
        log.debug(`KeyringController - getKeyringForAccount: ${hexed}`)

        return Promise.all(this.keyrings.map((keyring) => {
            return Promise.all([
                keyring,
                keyring.getAccounts(),
            ])
        }))
            .then((candidates) => {
                const winners = candidates.filter((candidate) => {
                    const accounts = candidate[1].map(normalizeAddress)
                    return accounts.includes(hexed)
                })
                if (winners && winners.length > 0) {
                    return winners[0][0]
                }
                throw new Error('No keyring found for the requested account.')

            })
    }

    /**
     * Display For Keyring
     *
     * Is used for adding the current keyrings to the state object.
     * @param {Keyring} keyring
     * @returns {Promise<Object>} A keyring display object, with type and accounts properties.
     */
    displayForKeyring(keyring) {
        return keyring.getAccounts()
            .then((accounts) => {
                return {
                    type: keyring.type,
                    accounts: accounts.map(normalizeAddress),
                }
            })
    }

    /**
     * Clear Keyrings
     *
     * Deallocates all currently managed keyrings and accounts.
     * Used before initializing a new vault.
     */
    /* eslint-disable require-await */
    async clearKeyrings() {
        // clear keyrings from memory
        this.keyrings = []
        this.memStore.updateState({
            keyrings: [],
        })
    }

    /**
     * Update Memstore Keyrings
     *
     * Updates the in-memory keyrings, without persisting.
     */
    async _updateMemStoreKeyrings() {
        const keyrings = await Promise.all(this.keyrings.map(this.displayForKeyring))
        return this.memStore.updateState({ keyrings })
    }

    /**
     * Unlock Keyrings
     *
     * Unlocks the keyrings.
     *
     * @emits KeyringController#unlock
     */
    setUnlocked() {
        this.memStore.updateState({ isUnlocked: true })
        this.emit('unlock')
    }

}

module.exports = { KeyringController }