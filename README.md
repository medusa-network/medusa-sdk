# About
The Typescript library for developers to use with Medusa-enabled applications

# Installation

```bash
npm install --save @medusa-network/medusa-sdk
```

# Usage

[See the demo application for more examples of usage](https://github.com/medusa-network/medusa-app)

```typescript
import { Medusa, EVMG1Point, SuiteType } from "@medusa-network/medusa-sdk";

// Initialize medusa with:
// - An encryption suite (bn254 curve + keypair in G1 + HGamal encryption algorithm)
// - A signer for a user
// - The address of the Medusa Encryption Oracle contract
const signer = new ethers.Wallet(userPrivateKey)
const medusaOracleAddress = "0xabc...123"
const medusa = await Medusa.init(SuiteType.BN254_KEYG1_HGAMAL, signer, medusaOracleAddress);
// Note: Medusa can be initialized one or more times for a given encryption suite

// Get Public Key of Medusa Oracle contract
const medusaPublicKey = await medusa.getPublicKey()

// Prompt a user to sign a message with their wallet and derive their medusa keypair from their (deterministic) signature
await medusa.signAndDeriveKeypair();

// Encrypt data towards Medusa
const { encryptedData, encryptedKey } = await medusa.encrypt(
  "This is secret!",
  myApplicationContractAddress,
);

// At this point, the encryptedKey should be submitted to Medusa as ciphertext.
// The encryptedData should be stored in a public store like ipfs / Filecoin / Arweave / AWS s3 etc.

// At a later point, another user would request the encryptedKey to be reencrypted towards themself
// If that request is valid according to the application's access control policy,
// the user will fetch the reencrypted key as ciphertext
// The application should also fetch the encryptedContents from the data store

// Decrypt encryptedContents using reencrypted ciphertext from Medusa
// If a user has not signed a message for Medusa yet,
// this will prompt them to sign a message in order to retrieve their Medusa private key
const decryptedBytes = await medusa.decrypt(
  ciphertext,
  encryptedContents,
);
const plaintext = new TextDecoder().decode(decryptedBytes)

// Generate random keypair; useful for testing purposes
const keypair = Medusa.newKeypair(medusa.suite);
```

# Development
```bash
yarn build:bindings

yarn test

yarn lint

yarn build
```
