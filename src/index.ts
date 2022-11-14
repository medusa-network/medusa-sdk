import { Base64 } from "js-base64";
import { BigNumber, utils } from "ethers";

import { init as initBn254 } from "./bn254";
import { Point, Scalar, Curve, EVMG1Point } from "./algebra";
import { EncryptionBundle, HGamalSuite, Label } from "./encrypt";
import { DleqSuite } from "./dleq";

import {
  Ciphertext as HGamalCipher,
  EVMCipher as HGamalEVMCipher,
} from "./hgamal";

export { HGamalEVMCipher };
export { EVMG1Point } from "./algebra";

// The public key is a point of scalars
export type PublicKey<S extends Scalar> = Point<S>;
// The secret key is a scalar value
export type SecretKey = Scalar;

// A keypair consists of a public key and a secret scalar value
export interface Keypair<S extends SecretKey, P extends PublicKey<S>> {
  secret: S;
  pubkey: P;
}

// The available encryption suites supported by Medusa
export const enum SuiteType {
  BN254_KEYG1_HGAMAL = "bn254-keyG1-hgamal",
}

/**
 * Core class to handle encryption suites, curve initialization, generation of keys and encryption / decryption
 */
export class Medusa<S extends SecretKey, P extends PublicKey<S>> {
  // TODO: Medusa class should be generic over encryption suites as well
  readonly suite: Curve<S, P> & DleqSuite<S, P>;

  /**
   * Setup Medusa instance
   * @param {Curve<S, P> & DleqSuite<S, P>} suite to use with encryption / decryption
   */
  constructor(suite: Curve<S, P> & DleqSuite<S, P>) {
    this.suite = suite;
  }

  /**
   * Initialize the finite field curve for the specified encryption suite and return a corresponding Medusa instance
   * @param {SuiteType} suiteType to use with encryption / decryption
   * @returns {Promise<Medusa<S, P>>} Medusa instance
   */
  static async init(
    suiteType: SuiteType
  ): Promise<Medusa<SecretKey, PublicKey<SecretKey>>> {
    switch (suiteType) {
      case "bn254-keyG1-hgamal":
        return new Medusa(await initBn254());
      default:
        throw new Error(`unknown suite type: ${suiteType}`);
    }
  }

  /**
   * Generate a random keypair
   * @param {C} curve to use for key generation
   * @returns {Promise<Medusa<S, P>>} Medusa instance
   */
  static newKeypair<
    S extends Scalar,
    P extends Point<S>,
    C extends Curve<S, P>
  >(curve: C): Keypair<S, P> {
    const priv = curve.scalar().random();
    const pubkey = curve.point().one().mul(priv);
    const kp: Keypair<S, P> = {
      secret: priv,
      pubkey: pubkey,
    };
    return kp;
  }

  /**
   * Derive a medusa keypair from a signature
   * @param {string} signature to use for key derivation
   * @returns {Keypair<S, P>} A Medusa Keypair
   */
  deriveKeypair(signature: string): Keypair<S, P> | undefined {
    // Hashing the signature
    const hash = utils.keccak256(signature);
    let random = BigNumber.from(hash);
    let n = 0;
    while (true) {
      try {
        // Take the scalar from the random number
        random = random.add(n);
        const secret = this.suite.scalar().fromEvm(random)._unsafeUnwrap();
        // Calculate the key: P = G * s
        const pubkey = this.suite.point().one().mul(secret);
        return {
          secret,
          pubkey,
        };
      } catch (e) {
        n++;
      }
    }
  }

  /**
   * Convert a public key from EVM into Medusa format
   * @param {EVMG1Point} pubkey to decode
   * @returns {P} A Medusa Public Key
   */
  decodePublicKey(pubkey: EVMG1Point): P {
    return this.suite.point().fromEvm(pubkey)._unsafeUnwrap();
  }

  /**
   * Encrypt a message for a user; include a label to prevent replay attacks via onchain DLEQ verification
   * @param {Uint8Array} data to encrypt
   * @param {P} medusaPublicKey of the encryption oracle to encrypt towards
   * @param {string} contractAddress of the application developer's contract to be included in the label
   * @param {string} userAddress of the user to be included in the label
   * @returns {Promise<{encryptedData: string, encryptedKey: HGamalEVMCipher}>} The encrypted data and the EVM encoded encrypted key
   */
  async encrypt(
    data: Uint8Array,
    medusaPublicKey: P,
    contractAddress: `0x${string}`,
    userAddress: `0x${string}`
  ): Promise<{ encryptedData: string; encryptedKey: HGamalEVMCipher }> {
    const hgamalSuite = new HGamalSuite(this.suite);
    const label = Label.from(medusaPublicKey, contractAddress, userAddress);
    const bundle = (
      await hgamalSuite.encryptToMedusa(data, medusaPublicKey, label)
    )._unsafeUnwrap();

    return {
      encryptedKey: bundle.encryptedKey.toEvm(),
      encryptedData: Base64.fromUint8Array(bundle.encryptedData),
    };
  }

  /**
   * Decrypt a message that has been reencrypted for a user
   * @param {HGamalEVMCipher} ciphertext of encrypted key to decrypt encryptedContents
   * @param {string} encryptedContents to decrypt
   * @param {S} userPrivateKey of the user to decrypt ciphertext
   * @param {P} medusaPublicKey of the medusa encryption oracle
   * @returns {Promise<string>} The decrypted data
   */
  async decrypt(
    ciphertext: HGamalEVMCipher,
    encryptedContents: string,
    userPrivateKey: S,
    medusaPublicKey: P
  ): Promise<string> {
    // Base64 decode into Uint8Array
    const encryptedData = Base64.toUint8Array(encryptedContents);

    const hgamalSuite = new HGamalSuite(this.suite);

    // Convert the ciphertext to a format that the Medusa SDK can use
    const cipher = HGamalCipher.default(this.suite)
      .fromEvm(ciphertext)
      ._unsafeUnwrap();

    // Create bundle with encrypted data and extraneous cipher (not used)
    const bundle: EncryptionBundle<HGamalEVMCipher, HGamalCipher<S, P>> = {
      encryptedData,
      encryptedKey: cipher,
    };

    // Decrypt
    const decryptionRes = await hgamalSuite.decryptFromMedusa(
      userPrivateKey,
      medusaPublicKey,
      bundle,
      cipher
    );
    // Decode to string
    return new TextDecoder().decode(decryptionRes._unsafeUnwrap());
  }
}
