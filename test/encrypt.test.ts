import * as hgamal from "./../src/hgamal";
import { BigNumber } from "ethers";
import { newKeypair, KeyPair } from "../src";
import { init, curve, G1 } from "../src/bn254";
import { Scalar, Point, Curve } from "../src/algebra";

import assert from "assert";
import { hexlify, arrayify } from "ethers/lib/utils";
import { arrayToBn } from "../src/utils";

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

function pointFromXY(x: string, y: string): G1 {
  const xa = arrayToBn(arrayify(x), true);
  const ya = arrayToBn(arrayify(y), true);
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
      random_priv:
        "0x62baa35bc6f8edbb60512bfa43f94e2610961b0c3e2427f37d1686f762d95729",
      shared: {
        x: "0xf8268467dd4facfe2c8b5948c2c168fc95e62bc7afac761cc680a124f3869011",
        y: "0xb1161d60e66c3852e0425c049852ae6ece3687262674b7f03e65cb32c60ad514",
      },
      hkdf: "0x3d413bf9145a1f9078028d8ee29c5d889bac04a5e6b2f3c446f1306051af54be",
      proxypub: {
        x: "0x9f59d738c1874650db47602b7c24c1dc0f175a9fe359dae104b97d706824bc2c",
        y: "0xb0354aea16b863c49bebd5e7712a7d74322a15ef4bc929ce43fc6d80f061e905",
      },
      proxypriv:
        "0x80af809fbe82ae3098f2ce1277e7790b400f8da374c8fbf3fde3bc12c90c491f",
      bobpriv:
        "0x1464f66a1da46c9cfd8eeb834a6b9b911fc2e1f1e31d4bf95c8ca81ddbe82e0e",
      cipher: {
        random: {
          x: "0xa42689dafc399bc6714ea20019db27d603e64bfd6bc0bb3d3f79dc192fc4fd06",
          y: "0x3c8527a1a867107fa7927c48c60d0d90a21dbb8a839f8a71fb48479062bf1508",
        },
        cipher:
          "0x746656d97a356bb01e6dffae8dee7de9fccd6dcb95c6dfe4329e101439ca74dd",
      },
      reenccipher: {
        random: {
          x: "0x1489fc95951cc38bc34d3388f770975e1865f09dde4af8513dc25005bfd8d52d",
          y: "0xc457811aebe8249cc825ead9be88896abc0b81292c76a1029f6122515e2cde08",
        },
        cipher:
          "0x746656d97a356bb01e6dffae8dee7de9fccd6dcb95c6dfe4329e101439ca74dd",
      },
      plain:
        "0x49276d206e6f7420666f72206f7220616761696e73742c20746f207468652063",
    };

    // First check if the proxy keys are correctly decoded
    const proxyPub = pointFromXY(data.proxypub.x, data.proxypub.y);
    const proxyPriv = curve
      .scalar()
      .fromEvm(arrayToBn(arrayify(data.proxypriv)))
      ._unsafeUnwrap();
    const expProxyPub = curve.point().one().mul(proxyPriv);
    assert.strictEqual(
      hexlify(expProxyPub.serialize()),
      hexlify(proxyPub.serialize()),
      "exp:" + expProxyPub.serialize() + " found " + proxyPub.serialize()
    );
    // Then check if reconstructing the shared key gives the same as expected
    const shared = pointFromXY(data.shared.x, data.shared.y);
    const tmp_priv = curve
      .scalar()
      .fromEvm(arrayToBn(arrayify(data.random_priv)))
      ._unsafeUnwrap();
    const expShared = curve.point().set(proxyPub).mul(tmp_priv);
    assert.strictEqual(
      hexlify(shared.serialize()),
      hexlify(expShared.serialize())
    );

    // Then check if the HKDF step is done in a similar fashion in JS and rust
    // for the encryption - note during the reencryption it doesn't change
    const hkdfComputed = await hgamal.sharedKey(shared);
    const hkdfFound = arrayify(data.hkdf);
    assert.strictEqual(hexlify(hkdfComputed), hexlify(hkdfFound));

    // Then check if reencrypting yourself gives expected result
    const bobpriv = curve
      .scalar()
      .fromEvm(arrayToBn(arrayify(data.bobpriv)))
      ._unsafeUnwrap();
    const bobpub = curve.point().one().mul(curve.scalar().set(bobpriv));
    const random = pointFromXY(data.cipher.random.x, data.cipher.random.y);
    const cipher = new hgamal.Ciphertext(random, arrayify(data.cipher.cipher));
    // we compute the reencryption
    const reencExp = reencrypt(
      curve,
      { secret: proxyPriv, pubkey: curve.point().set(proxyPub) },
      bobpub,
      cipher
    );
    // and check with what is expected from rust side
    const reencRandom = pointFromXY(
      data.reenccipher.random.x,
      data.reenccipher.random.y
    );
    const reencCipher = new hgamal.Ciphertext(
      reencRandom,
      arrayify(data.reenccipher.cipher)
    );
    assert.strictEqual(
      hexlify(reencCipher.random.serialize()),
      hexlify(reencExp.random.serialize())
    );
    assert.strictEqual(hexlify(reencCipher.cipher), hexlify(reencExp.cipher));

    // Then tries to decrypt for yourself
    const m = await hgamal.decryptReencryption(
      curve,
      bobpriv,
      proxyPub,
      reencCipher
    );
    assert.ok(m.isOk());
    const p = m._unsafeUnwrap();
    assert.strictEqual(data.plain, hexlify(p));
  });
});
