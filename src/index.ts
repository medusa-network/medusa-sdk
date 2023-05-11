import { BigNumber, ethers, utils } from 'ethers';

import { init as initBn254 } from './bn254';
import { Point, Scalar, Curve, EVMG1Point } from './algebra';
import { EncryptionBundle, HGamalSuite, Label } from './encrypt';
import { DleqSuite } from './dleq';

import {
  Ciphertext as HGamalCipher,
  EVMCipher as HGamalEVMCipher,
  MedusaReencryption as HGamalReencryptedCipher,
  EVMReencryptedCipher as HGamalEVMReencryptedCipher,
} from './hgamal';
import {
  /* eslint-disable-next-line camelcase */
  EncryptionOracle__factory,
  /* eslint-disable-next-line camelcase */
  ThresholdNetwork__factory,
} from '../typechain';

export { HGamalEVMCipher, HGamalEVMReencryptedCipher };
export { EVMG1Point } from './algebra';
import { NETWORK_CONFIG, NetworkEnvironment } from './config';
import { GAS_UNIT_BUFFER, MINIMUM_BASE_FEE } from './constants';

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
export enum SuiteType {
  BN254_KEYG1_HGAMAL = 0,
}

/**
 * Core class to handle encryption suites, curve initialization, generation of keys and encryption / decryption
 */
export class Medusa<S extends SecretKey, P extends PublicKey<S>> {
  // TODO: Medusa class should be generic over encryption suites as well

  // The user's medusa keypair
  keypair: Keypair<S, P> | undefined;

  readonly suite: Curve<S, P> & DleqSuite<S, P>;
  // A signer for the user in order to derive the user's medusa keypair and to get their address
  readonly signer: ethers.Signer;
  // The address of the medusa oracle contract
  readonly medusaAddress: string;
  // The public key of the medusa oracle contract
  private publicKey: P | undefined;
  // The network environment of Medusa
  private network: NetworkEnvironment;

  /**
   * Setup Medusa instance
   * @param {Curve<S, P> & DleqSuite<S, P>} suite to use with encryption / decryption
   * @param {ethers.Signer} signer The signer with attached provider used to interact with Medusa
   * @param {string} medusaAddress The address of the medusa oracle being used
   */
  constructor(
    suite: Curve<S, P> & DleqSuite<S, P>,
    signer: ethers.Signer,
    medusaAddress: string,
    network: NetworkEnvironment = 'testnet',
  ) {
    this.suite = suite;
    this.signer = signer;
    this.medusaAddress = medusaAddress;
    this.network = network;
  }

  /**
   * Initialize the finite field curve for the encryption suite and return a corresponding Medusa instance
   * @param {string} medusaAddress The address of the medusa oracle being used
   * @param {ethers.Signer} signer The signer with attached provider used to interact with Medusa
   * @param {NetworkEnvironment} network The network environment of Medusa
   * @returns {Promise<Medusa<S, P>>} Medusa instance
   */
  static async init(
    medusaAddress: string,
    signer: ethers.Signer,
    network: NetworkEnvironment = 'testnet',
  ): Promise<Medusa<SecretKey, PublicKey<SecretKey>>> {
    if (!signer.provider) {
      throw new Error('Medusa: Signer must have an attached provider');
    }

    const medusaContract = EncryptionOracle__factory.connect(
      medusaAddress,
      signer,
    );

    const suite = await medusaContract.suite();

    switch (suite as SuiteType) {
      case SuiteType.BN254_KEYG1_HGAMAL: {
        const medu = new Medusa(
          await initBn254(),
          signer,
          medusaAddress,
          network,
        );
        await medu.fetchPublicKey();
        return medu;
      }
      default:
        throw new Error(`unknown suite type: ${suite}`);
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
    C extends Curve<S, P>,
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
   * Set a user's medusa keypair
   * @param {Keypair<S, P>} keypair saved as a static variable on the Medusa class
   */
  setKeypair(keypair: Keypair<S, P>): void {
    this.keypair = keypair;
  }

  /**
   * Request a user's signature, derive a keypair from it and set it as a static variable on the Medusa class
   */
  async signForKeypair(): Promise<Keypair<S, P>> {
    if (this.keypair) {
      return this.keypair;
    }
    const signature = await this.signer.signMessage('Sign in to Medusa');
    const kp = this.deriveKeypair(signature);
    this.setKeypair(kp);
    return kp;
  }

  /**
   * Derive a medusa keypair from a signature
   * @param {string} signature to use for key derivation
   * @returns {Keypair<S, P>} A Medusa Keypair
   */
  deriveKeypair(signature: string): Keypair<S, P> {
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
      } catch (_e) {
        n++;
      }
    }
  }

  /**
   * Fetch the public key of the Medusa Oracle, cache it, and return it
   * @returns {Promise<P>} The Medusa Public Key
   */
  async fetchPublicKey(): Promise<P> {
    if (this.publicKey) {
      return this.publicKey;
    }
    const medusaContract = ThresholdNetwork__factory.connect(
      this.medusaAddress,
      this.signer,
    );
    const key = await medusaContract.distributedKey();
    this.publicKey = this.decodePublicKey(key);
    return this.publicKey;
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
   * @param {string} contractAddress of the application developer's contract to be included in the label
   * @returns {Promise<{encryptedData: string, encryptedKey: HGamalEVMCipher}>} The encrypted data and the EVM encoded encrypted key
   */
  async encrypt(
    data: Uint8Array,
    contractAddress: string,
  ): Promise<{ encryptedData: Uint8Array; encryptedKey: HGamalEVMCipher }> {
    const medusaPublicKey = await this.fetchPublicKey();
    const hgamalSuite = new HGamalSuite(this.suite);
    const label = Label.from(
      medusaPublicKey,
      contractAddress,
      await this.signer.getAddress(),
    );
    const bundle = (
      await hgamalSuite.encryptToMedusa(data, medusaPublicKey, label)
    )._unsafeUnwrap();

    return {
      encryptedKey: bundle.encryptedKey.toEvm(),
      encryptedData: bundle.encryptedData,
    };
  }

  /**
   * Decrypt a message that has been reencrypted for a user
   * @param {HGamalEVMCipher} ciphertext of encrypted key to decrypt encryptedContents
   * @param {HGamalEVMReencryptedCipher} reencryptedCipher of encrypted key to decrypt encryptedContents
   * @param {Uint8Array} encryptedData to decrypt
   * @returns {Promise<Uint8Array>} The decrypted data
   */
  async decrypt(
    ciphertext: HGamalEVMCipher,
    reencryptedCipher: HGamalEVMReencryptedCipher,
    encryptedData: Uint8Array,
  ): Promise<Uint8Array> {
    const hgamalSuite = new HGamalSuite(this.suite);

    // Convert the ciphertext to a format that the Medusa SDK can use
    const cipher = HGamalCipher.default(this.suite)
      .fromEvm(ciphertext)
      ._unsafeUnwrap();
    const reencryption = HGamalReencryptedCipher.default(this.suite)
      .fromEvm(reencryptedCipher)
      ._unsafeUnwrap();

    // Create bundle with encrypted data and extraneous cipher (not used)
    const bundle: EncryptionBundle<HGamalEVMCipher, HGamalCipher<S, P>> = {
      encryptedData,
      encryptedKey: cipher,
    };

    const kp = await this.signForKeypair();
    // Decrypt
    const decryptionRes = await hgamalSuite.decryptFromMedusa(
      kp.secret,
      await this.fetchPublicKey(),
      bundle,
      reencryption,
    );
    return decryptionRes._unsafeUnwrap();
  }

  /**
   * The total amount that must be paid for a call to oracle.submitCiphertext().
   *
   * @async
   * @returns {Promise<BigNumber>} A promise that resolves to the submission fee as a BigNumber.
   */
  async submissionFee(): Promise<BigNumber> {
    const oracle = EncryptionOracle__factory.connect(
      this.medusaAddress,
      this.signer.provider!,
    );
    return await oracle.submissionFee();
  }

  /**
   * The total amount that must be paid for a call to oracle.requestReencryption().
   * Includes the oracle.reencryptionFee() and the callback gas estimate.
   *
   * @async
   * @param {string} contractAddress - The contract address of the application to estimate the callback gas for.
   * @returns {Promise<BigNumber>} A promise that resolves to the total fee as a BigNumber.
   */
  async reencryptionFee(contractAddress: string): Promise<BigNumber> {
    const oracle = EncryptionOracle__factory.connect(
      this.medusaAddress,
      this.signer.provider!,
    );
    const reencryptionFee = await oracle.reencryptionFee();
    return (
      await this.estimateCallbackGas(contractAddress, reencryptionFee)
    ).add(reencryptionFee);
  }

  /**
   * Estimates the callback gas for a given contract address.
   *
   * @async
   * @param {string} contractAddress - The contract address of the application to estimate the callback gas for.
   * @returns {Promise<BigNumber>} A promise that resolves to the estimated callback gas as a BigNumber.
   */
  private async estimateCallbackGas(
    contractAddress: string,
    reencryptionFee: BigNumber,
  ): Promise<BigNumber> {
    const oracle = EncryptionOracle__factory.connect(
      this.medusaAddress,
      this.signer.provider!,
    );
    const gasUnits = await oracle.estimateGas.estimateDeliverReencryption(
      BigNumber.from(0),
      {
        random: { x: BigNumber.from(1), y: BigNumber.from(1) },
      },
      contractAddress,
      {
        from: NETWORK_CONFIG[this.network].relayerAddr,
        value: reencryptionFee,
      },
    );

    const feeData = await this.signer.getFeeData();
    let gasPrice = feeData.maxFeePerGas!;
    // If the base fee < 1000 wei, we are probably in localhost so add a minimum base fee to correct this.
    if (feeData.lastBaseFeePerGas?.lt(BigNumber.from(1000))) {
      gasPrice = gasPrice.add(MINIMUM_BASE_FEE);
    }

    // Add 10k gas units as a heuristic buffer
    // The estimation on the frontend is 10k less vs. on the relayer node
    // When testing locally with anvil
    return gasUnits.add(GAS_UNIT_BUFFER).mul(gasPrice);
  }
}
