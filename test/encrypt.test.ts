import * as hgamal from "./../src/hgamal";
import { BigNumber } from "ethers";
import { newKeypair, KeyPair } from "../src";
import { init, curve, G1 } from "../src/bn254";
import { Scalar, Point, Curve } from "../src/algebra";

import assert from "assert";
import { hexlify, arrayify } from "ethers/lib/utils";

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

function pointFromXY(x: String, y: String): G1 {
  const xa = BigNumber.from(x);
  const ya = BigNumber.from(y);
  const p = curve.point().fromEvm({ x: xa, y: ya });
  assert(p.isOk());
  return p._unsafeUnwrap();
}

describe("hgamal encryption", () => {
  before(async () => {
    await init();
  });

  it("decryption of reencryption", async () => {
    const proxy = newKeypair(curve);
    const bob = newKeypair(curve);
    const msgStr = "Hello Bob";
    const msgBuff = new TextEncoder().encode(msgStr.padEnd(32, "\0"));
    const c = await hgamal.encrypt(curve, proxy.pubkey, msgBuff);
    assert.ok(c.isOk());
    const ciphertext = c._unsafeUnwrap();
    const reencryption = reencrypt(curve, proxy, bob.pubkey, ciphertext);
    const m = await hgamal.decryptReencryption(
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
  it("compatible with rust implementation", async () => {
    const data = {
      proxypub: {
        x: "0xd5ba39ea593a190dad9102db7b2673d0301db16925077b18cf69e320e3c2ae08",
        y: "0x76b113e56ea38fa7526c7c1e2fe02ab32a77f88dd7a5e1ddd513961077246619",
      },
      bobpriv:
        "0xa4219c33297c77a77908b74916bcadd9e1a64414a2c843285928db4581254b28",
      cipher: {
        random: {
          x: "0x0fc3c72156587bb172ca343a6d80628811d82d39c61c7c6c6d7fb8cf7d2a7d2b",
          y: "0xce01ca07b53d6df7a3b55f5dd57ee4a70b63fa2b363e2e67982059d339359020",
        },
        cipher:
          "0x96fb8722f2f52bb4daedf529732b1386f4157cb3e1ef8c6f12d99ce3bbc2d9ee",
      },
      plain:
        "0x49276d206e6f7420666f72206f7220616761696e73742c20746f207468652063",
      shared: {
        x: "0xeff1ccd6d6fdf06def2d1c9c58b9bde0c726cb705bba26a55dc80b43e7b3ab0d", 
        y: "0xbf405ecd179845f87d89c28dc6d51cac9a04c2f7df5be46da29c54178cc59f09",
      }
    };
    const proxyPub = pointFromXY(data.proxypub.x, data.proxypub.y);
    const random = pointFromXY(data.cipher.random.x, data.cipher.random.y);
    const cipher = new hgamal.Ciphertext(random, arrayify(data.cipher.cipher));
    const bobpriv = curve
      .scalar()
      .fromEvm(BigNumber.from(data.bobpriv))
      ._unsafeUnwrap();
    const m = await hgamal.decryptReencryption(
      curve,
      bobpriv,
      proxyPub,
      cipher
    );
    assert.ok(m.isOk());
    const p = m._unsafeUnwrap();
    assert.strictEqual(data.plain, hexlify(p));
  });
});
