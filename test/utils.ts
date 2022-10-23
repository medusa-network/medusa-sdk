import { KeyPair } from "../src";
import { Curve, Point, Scalar } from "../src/algebra";
import * as hgamal from "../src/hgamal";

export function reencrypt<S extends Scalar, P extends Point<S>>(
  c: Curve<S, P>,
  kp: KeyPair<S, P>,
  recipient: P,
  cipher: hgamal.Ciphertext<S, P>
): hgamal.MedusaReencryption<S, P> {
  // Input is { rG, H(rP) ^ m }
  // where P=pG is public key of proxy (kp)
  // B=bG is the recipient key
  // Output is
  // prG + pB = p(rG + B)
  // see hgamal script for more details
  const random = c.point().set(recipient).add(cipher.random).mul(kp.secret);
  const reenc = new hgamal.MedusaReencryption(random);
  return reenc;
}