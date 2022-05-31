import * as hgamal from "./../src/hgamal";
import { newKeypair, KeyPair } from "../src";
import { init, curve } from "../src/bn254";
import { Scalar, Point, Curve } from "../src/algebra";

import assert from "assert";

function reencrypt<S extends Scalar, P extends Point<S>>(
  c: Curve<S, P>,
  kp: KeyPair<S, P>,
  recipient: P,
  cipher: hgamal.Ciphertext<S, P>
): hgamal.Ciphertext<S, P> {
  // Input is { rG, H(rP) ^ m }
  // where P=pG is public key of proxy (kp)
  // B=bG is the recipient key
  // Output is
  // prG + pB = p(rG + B)
  // see hgamal script for more details
  const random = c.point().set(recipient).add(cipher.random).mul(kp.secret);
  const reenc = new hgamal.Ciphertext(random, cipher.cipher);
  return reenc;
}

describe("hgamal encryption", () => {
  before(async () => {
    await init();
  });

  it("decryption of reencryption", () => {
    const proxy = newKeypair(curve);
    const bob = newKeypair(curve);
    const msgStr = "Hello Bob";
    const msgBuff = new TextEncoder().encode(msgStr.padEnd(32, "\0"));
    const c = hgamal.encrypt(curve, proxy.pubkey, msgBuff);
    assert.ok(c.isOk());
    const ciphertext = c._unsafeUnwrap();
    const reencryption = reencrypt(curve, proxy, bob.pubkey, ciphertext);
    const m = hgamal.decryptReencryption(
      curve,
      bob.secret,
      proxy.pubkey,
      reencryption
    );
    assert.ok(m.isOk());
    const found = m._unsafeUnwrap();
    let canonical: string = new TextDecoder().decode(found);
    canonical = canonical.replaceAll("\0", "");
    assert.strictEqual(msgStr, canonical);
  });
});
