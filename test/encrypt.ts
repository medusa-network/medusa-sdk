import * as hgamal from "../src/hgamal";
import { BigNumber } from "ethers";
import { newKeypair, KeyPair } from "../src";
import { init, suite as curve, G1 } from "../src/bn254";
import { Scalar, Point, Curve } from "../src/algebra";
import assert from "assert";
import { hexlify, arrayify } from "ethers/lib/utils";
import { arrayToBn, bnToArray } from "../src/utils";
import { HGamalSuite } from "../src/encrypt";
import { ShaTranscript } from "../src/transcript";
import { reencrypt } from "./hgamal";
import * as sha256 from "fast-sha256";


describe("medusa encryption", () => {
  before(async () => {
    await init();
  });

  it("full scheme", async () => {
    const proxy = newKeypair(curve);
    const suite = new HGamalSuite(curve);
    const bob = suite.keyForDecryption();
    const msgStr =
      "None of us is great enough for such a task. But in all circumstances of life, in obscurity or temporary fame, cast in the irons of tyranny or for a time free to express himself, the writer can win the heart of a living community that will justify him, on the one condition that he will accept to the limit of his abilities the two tasks that constitute the greatness of his craft: the service of truth and the service of liberty. Because his task is to unite the greatest possible number of people, his art must not compromise with lies and servitude which, wherever they rule, breed solitude. Whatever our personal weaknesses may be, the nobility of our craft will always be rooted in two commitments, difficult to maintain: the refusal to lie about what one knows and the resistance to oppression.";
    const msgBuff = new TextEncoder().encode(msgStr.padEnd(32, "\0"));
    /// TODO: have an API to pass in the smart contract address the encryptor, the medusa public key, the chain id
    const label = sha256.hash(new TextEncoder().encode("that's my address"));
    const c = await suite.encryptToMedusa(msgBuff, proxy.pubkey, label);
    assert.ok(c.isOk());
    const bundle = c._unsafeUnwrap();
    const reencryption = reencrypt(
      curve,
      proxy,
      bob.pubkey,
      bundle.encryptedKey
    );
    const m = await suite.decryptFromMedusa(
      bob.secret,
      proxy.pubkey,
      bundle,
      reencryption,
    );
    assert.ok(m.isOk());
    const found = m._unsafeUnwrap();
    let canonical: string = new TextDecoder().decode(found);
    canonical = canonical.replaceAll("\0", "");
    assert.strictEqual(msgStr, canonical);
  });
});
