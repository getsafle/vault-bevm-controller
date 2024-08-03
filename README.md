
# vault-bevm-controller<code><a href="https://www.docker.com/"  target="_blank"><img height="50"  src="https://drive.google.com/file/d/1ipV6tw8LE7S6iMJrx98MA8NAE87OAohQ/view?usp=sharing"></a></code>

  

[![npm version](https://badge.fury.io/js/@getsafle%2Fvault-bevm-controller.svg)](https://badge.fury.io/js/@getsafle%2Fvault-bevm-controller) <img  alt="Static Badge"  src="https://img.shields.io/badge/License-MIT-green"> [![Discussions][discussions-badge]][discussions-link]

<img  alt="Static Badge"  src="https://img.shields.io/badge/BEVM_controller-documentation-purple">

  

A Module written in javascript for managing various keyrings of BEVM accounts, encrypting them, and using them. This repository contains `BEVMHdKeyring` class to create **BEVM wallet** from **Safle Vault**.

  
  

- [Installation](#installation)

- [Initialize the BEVM Controller class](#initialize-the-bevm-controller-class)

- [Methods](#methods)

- [Generate Keyring with 1 account and encrypt](#generate-keyring-with-1-account-and-encrypt)

- [Restore a keyring with the first account using a mnemonic](#restore-a-keyring-with-the-first-account-using-a-mnemonic)

- [Add a new account to the keyring object](#add-a-new-account-to-the-keyring-object)

- [Export the private key of an address present in the keyring](#export-the-private-key-of-an-address-present-in-the-keyring)

- [Sign a transaction](#sign-a-transaction)

- [Sign a message](#sign-a-message)

- [Get balance](#get-balance)

  
  
  

## Installation

  

`npm install --save @getsafle/vault-bevm-controller`

  

## Initialize the BEVM Controller class

  

```

const { KeyringController, getBalance } = require('@getsafle/vault-bevm-controller');

  

const bevmController = new KeyringController({

encryptor: {

// An optional object for defining encryption schemes:

// Defaults to Browser-native SubtleCrypto.

encrypt(password, object) {

return new Promise('encrypted!');

},

decrypt(password, encryptedString) {

return new Promise({ foo: 'bar' });

},

},

});

```

  

## Methods

  

### Generate Keyring with 1 account and encrypt

  

```

const keyringState = await bevmController.createNewVaultAndKeychain(password);

```

  

### Restore a keyring with the first account using a mnemonic

  

```

const keyringState = await bevmController.createNewVaultAndRestore(password, mnemonic);

```

  

### Add a new account to the keyring object

  

```

const keyringState = await bevmController.addNewAccount(keyringObject);

```

  

### Export the private key of an address present in the keyring

  

```

const privateKey = await bevmController.exportAccount(address);

```

  

### Sign a transaction

  

```

const signedTx = await bevmController.signTransaction(bevmTx, _fromAddress);

```

  

### Sign a message

  

```

const signedMsg = await bevmController.signMessage(msgParams);

```

  

### Sign a message

  

```

const signedObj = await bevmController.sign(msgParams, pvtKey, web3Obj);

```

  

### Sign Typed Data (EIP-712)

  

```

const signedData = await bevmController.signTypedMessage(msgParams);

```

  

### Get balance

  

```

const balance = await bevmController.getBalance(address, web3);

```

  

### Send Transaction

  

```

const receipt = await bevmController.sendTransaction(signedTx, web3);

```

  

### Calculate Tx Fees

  

```

const fees = await bevmController.getFees(rawTx, web3);

```

[discussions-badge]: https://img.shields.io/badge/Code_Quality-passing-rgba

[discussions-link]: https://github.com/getsafle/vault-bevm-controller/actions