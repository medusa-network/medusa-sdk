import { BigNumber, utils } from "ethers";
import { Point, Scalar, Curve } from "./algebra";

export { suite, init } from "./bn254";
export { Ciphertext as HGamalCipher, EVMCipher as HGamalEVM } from "./hgamal";
export { HGamalSuite, EncryptionBundle, Label } from "./encrypt";
export { EVMG1Point as EVMPoint } from "./algebra";

export type PublicKey<S extends Scalar> = Point<S>;
export type SecretKey = Scalar;

export interface KeyPair<S extends Scalar, P extends Point<Scalar>> {
  secret: S;
  pubkey: P;
}

export function newKeypair<
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

export function calculateKeyPair<
  S extends Scalar,
  P extends Point<S>,
  C extends Curve<S, P>
>(c: C, signature: string): KeyPair<S, P> | undefined {
  // Hasing the signature
  const hash = utils.keccak256(signature);
  let BN = BigNumber.from(hash);
  let n = 0;
  while (true) {
    try {
      // Take the scalar from the number
      BN = BN.add(n);
      const priv = c.scalar().fromEvm(BN);
      // Unwrap to make it owkr with the mul function above
      const unwrapped = priv._unsafeUnwrap();
      // Continue the calculation of the key
      const pubkey = c.point().one().mul(unwrapped);
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
