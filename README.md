# About
The Typescript library for developers to use with Medusa-enabled applications

# Installation

```bash
npm install --save @medusa-network/medusa-sdk
```

# Usage

[See the demo application for more examples of usage](https://github.com/medusa-network/medusa-app)

```typescript
import { Medusa, EVMG1Point, SuiteType } from '@medusa-network/medusa-sdk'

// Initialize medusa with using the bn254 curve with the keypair in G1 using the HGamal encryption algorithm
const medusa = await Medusa.init(SuiteType.BN254_KEYG1_HGAMAL)

// Get Public Key of Medusa Oracle contract
// Note: Medusa can be initialized one or more times for a given encryption suite
const medusa = await Medusa.init(SuiteType.BN254_KEYG1_HGAMAL)
const medusaContract = new ethers.Contract( "0x.." , ["function distributedKey() external view returns (G1Point memory)"], signerOrProvider)
const medusaPublicKey = medusa.decodePublicKey(await medusaContract.distributedKey())

// Encrypt data towards Medusa
const { encryptedData, encryptedKey } = await medusa.encrypt('This is secret!', medusaPublicKey, myApplicationContractAddress, userAddress);

// Derive a user's keypair from their (deterministic) signature
const keypair = medusa.calculateKeypair(signature)

// Decrypt response from Medusa
const plaintext = await medusa.decrypt(ciphertext, encryptedContents, keypair.secret, medusaPublicKey)

// Generate random keypair for testing purposes
const medusa = await Medusa.init("bn254-keyG1-hgamal");
const keypair = Medusa.newKeypair(medusa.suite);
```

# Development
```bash
yarn build:bindings

yarn test

yarn lint

yarn build
```
