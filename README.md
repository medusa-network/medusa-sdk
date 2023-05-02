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
// - The address of the Medusa Encryption Oracle contract
// - A signer for a user
const signer = new ethers.Wallet(userPrivateKey).connect(ethers.getDefaultProvider());
const medusaOracleAddress = "0xabc...123"
const medusa = await Medusa.init(medusaOracleAddress, signer);
// Note: Medusa can be initialized one or more times for a given encryption suite

// Get Public Key of Medusa Oracle contract
const medusaPublicKey = await medusa.fetchPublicKey()

// Prompt a user to sign a message with their wallet and derive their medusa keypair from their (deterministic) signature
const keypair = await medusa.signForKeypair();

// Encrypt data towards Medusa
const { encryptedData, encryptedKey } = await medusa.encrypt(
  "This is secret!",
  myApplicationContractAddress,
);

// If sending encryptedData to a JSON api endpoint, base64 is a convenient encoding to use
import { Base64 } from "js-base64";
const b64EncryptedData = Base64.fromUint8Array(encryptedData)

// At this point, the encryptedKey should be submitted to Medusa as ciphertext.
// The encryptedData should be stored in a public store like ipfs / Filecoin / Arweave / AWS s3 etc.

// At a later point, another user would request the encryptedKey to be reencrypted towards themself
// If that request is valid according to the application's access control policy,
// the user will fetch the reencrypted key as ciphertext
// The application should also fetch the encryptedContents from the data store

// Decrypt encryptedContents using reencrypted ciphertext from Medusa
// If a user has not signed a message for Medusa yet,
// this will prompt them to sign a message in order to retrieve their Medusa private key
const encryptedData = Base64.toUint8Array(b64EncryptedData); // Only if encryptedData was base64 encoded, then base64 decode
const decryptedBytes = await medusa.decrypt(
  ciphertext,
  encryptedData,
);
const plaintext = new TextDecoder().decode(decryptedBytes) // To decode bytes to UTF-8
```

# Development
```bash
pnpm build:bindings

pnpm test

pnpm lint

pnpm build
```
