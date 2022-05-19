import * as hgamal from "./../src/hgamal";
import { newKeypair, KeyPair } from "../src";
import { init, curve } from "../src/bn254";
import { Scalar, Point } from "../src/algebra";

import assert from "assert";

function reencrypt<S extends Scalar, P extends Point<S>>(
  kp: KeyPair<S, P>,
  recipient: P,
  c: hgamal.Ciphertext<S,P>
): hgamal.Ciphertext<S,P> {
  // p(rG + B)
  // see hgamal script for more details
  const random = recipient.add(c.random).mul(kp.secret);
  const cipher = new hgamal.Ciphertext(random, c.cipher);
  return cipher;
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
    const reencryption = reencrypt(proxy, bob.pubkey, ciphertext);
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
