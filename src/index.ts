import { Base64 } from "js-base64";
import { BigNumber, utils } from "ethers";

import { init as initBn254, Bn254Suite } from "./bn254";
import { Point, Scalar, Curve } from "./algebra";
import { EncryptionBundle, HGamalSuite, Label } from "./encrypt";
import { DleqSuite } from "./dleq";

import {
  Ciphertext as HGamalCipher,
  EVMCipher as HGamalEVMCipher,
} from "./hgamal";

export { HGamalEVMCipher };
export { EVMG1Point } from "./algebra";

export type PublicKey<S extends Scalar> = Point<S>;
export type SecretKey = Scalar;

export interface KeyPair<S extends SecretKey, P extends PublicKey<S>> {
  secret: S;
  pubkey: P;
}

type SuiteType = "bn254-keyG1-hgamal";

export async function initMedusa(
  suiteType: SuiteType
): Promise<Medusa<SecretKey, PublicKey<SecretKey>>> {
  switch (suiteType) {
    case "bn254-keyG1-hgamal":
      initBn254();
      return new Medusa(new Bn254Suite());
    default:
      throw new Error(`unknown suite type: ${suiteType}`);
  }
}

export class Medusa<S extends SecretKey, P extends PublicKey<S>> {
  suite: Curve<S, P> & DleqSuite<S, P>;

  constructor(suite: Curve<S, P> & DleqSuite<S, P>) {
    this.suite = suite;
  }

  static newKeypair<
    S extends Scalar,
    P extends Point<S>,
    C extends Curve<S, P>
  >(c: C): KeyPair<S, P> {
    const priv = c.scalar().random();
    const pubkey = c.point().one().mul(priv);
    const kp: KeyPair<S, P> = {
      secret: priv,
      pubkey: pubkey,
    };
    return kp;
  }

  calculateKeyPair(signature: string): KeyPair<S, P> | undefined {
    // Hasing the signature
    const hash = utils.keccak256(signature);
    let BN = BigNumber.from(hash);
    let n = 0;
    while (true) {
      try {
        // Take the scalar from the number
        BN = BN.add(n);
        const priv = this.suite.scalar().fromEvm(BN);
        // Unwrap to make it owkr with the mul function above
        const unwrapped = priv._unsafeUnwrap();
        // Continue the calculation of the key
        const pubkey = this.suite.point().one().mul(unwrapped);
        const kp: KeyPair<S, P> = {
          secret: unwrapped,
          pubkey: pubkey,
        };
        return kp;
      } catch (e) {
        n++;
      }
    }
  }

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
