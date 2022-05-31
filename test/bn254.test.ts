//import test from "ava";
import assert from "assert";
import { init, curve } from "../src/bn254";
import { newKeypair } from "../src/index";
import { hexlify, arrayify } from "ethers/lib/utils";

describe("testing bn254 wrapper", () => {
  before(async () => {
    await init();
  });
  it("group operations", () => {
    const f1 = curve.scalar().random();
    const f2 = curve.scalar().random();
    const p1 = curve.point().one().mul(f1);
    const p2 = curve.point().one().mul(f2);
    const p3 = p1.add(p2);
    const f3 = f1.add(f2);
    const exp = curve.point().one().mul(f3);
    assert.ok(exp.equal(p3));
  });

  it("new keypair", () => {
    const kp = newKeypair(curve);
    assert.ok(!kp.pubkey.equal(curve.point().zero()));
    assert.ok(!kp.secret.equal(curve.scalar().zero()));
  });

  it("serialization scalar", () => {
    const f1 = curve.scalar().random();
    const b1 = f1.serialize();
    const f2 = curve.scalar().deserialize(b1);
    assert.ok(f2.isOk());
    assert.ok(f2._unsafeUnwrap().equal(f1));
  });

  it("serialization point", () => {
    const p1 = curve.point().random();
    const b1 = p1.serialize();
    const p2 = curve.point().deserialize(b1);
    assert.ok(p2.isOk());
    assert.ok(p2._unsafeUnwrap().equal(p1));
  });

  it("Compatibility with rust code", () => {
    const jsonObj = {
      base: {
        compressed:
          "0x0100000000000000000000000000000000000000000000000000000000000000",
        affine: {
          x: "0x0100000000000000000000000000000000000000000000000000000000000000",
          y: "0x0200000000000000000000000000000000000000000000000000000000000000",
        },
      },
      p: {
        compressed:
          "0x09df360bdc70c00e7b59d8e9a81a99da67be41eee07eb511bf1d208c38fe811e",
        affine: {
          x: "0x09df360bdc70c00e7b59d8e9a81a99da67be41eee07eb511bf1d208c38fe811e",
          y: "0x55b801514bf71c9fe72c6dd583f6cb3cc87c21a979c77f435f135a54134d9306",
        },
      },
    };
    // compatibility with base point in compressed form
    let r = curve.point().deserialize(arrayify(jsonObj.base.compressed));
    assert.ok(r.isOk());
    assert.ok(r._unsafeUnwrap().equal(curve.point().one()));
    // compatibility with base point in affine form
    const xbase = arrayify(jsonObj.base.affine.x);
    const ybase = arrayify(jsonObj.base.affine.y);
    r = curve.point().fromXY(xbase, ybase);
    assert.ok(r.isOk());
    assert.ok(r._unsafeUnwrap().equal(curve.point().one()));

    // compatibility with random point in compressed form
    r = curve.point().deserialize(arrayify(jsonObj.p.compressed));
    assert.ok(r.isOk());
    const p1 = r._unsafeUnwrap();
    assert.ok(p1.p.isValid() && p1.p.isValidOrder());
    // compatibility with random point in affine form
    const xp = arrayify(jsonObj.p.affine.x);
    const yp = arrayify(jsonObj.p.affine.y);
    r = curve.point().fromXY(xp, yp);
    assert.ok(r.isOk());
    const p2 = r._unsafeUnwrap();
    assert.ok(p2.p.isValid() && p2.p.isValidOrder());
    console.log(
      "p1.x = ",
      p1.p.getX().serializeToHexStr(),
      " - p1.y = ",
      p1.p.getY().serializeToHexStr()
    );
    console.log(
      "p2.x = ",
      p2.p.getX().serializeToHexStr(),
      " - p2.y = ",
      p2.p.getY().serializeToHexStr()
    );
    assert.ok(p1.equal(p2.neg()));
    console.log("random p: ", hexlify(p1.serialize()));
    console.log("random -p: ", hexlify(p1.neg().serialize()));
    console.log("random p.x: ", hexlify(p1.p.getX().serialize()));
    console.log("random p.y: ", hexlify(p1.p.getY().serialize()));
  });
});
