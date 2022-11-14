import assert from "assert";
import { BigNumber } from "ethers";
import { WasmCurve, WasmField1 } from "ffjavascript";
import { ethers } from "hardhat";
/* eslint-disable-next-line camelcase */
import { Playground__factory } from "../typechain";
import { init, Bn254Suite } from "../src/bn254";
import { EVMG1Point } from "../src/algebra";

describe("use ident", async () => {
  let group: WasmCurve;
  let field: WasmField1;
  let suite: Bn254Suite;

  before(async () => {
    suite = await init();
    group = globalThis.ffCurve.G1;
    field = globalThis.ffCurve.Fr;
  });

  // it("show bases", () => {
  //   const baseString = "MEDUSA_DLEQ_BN254_BASE2";
  //   const p = suite.point().setHashOf(baseString);
  //   const e = p.toEvm();
  //   console.log(baseString);
  //   console.log("x:", e.x.toString());
  //   console.log("y:", e.y.toString());
  // });

  it("suite serialization works", async () => {
    const p1 = suite.point().random();
    const buff = p1.serialize();
    const p2 = suite.point().deserialize(buff);
    // assert.ok(p2.isOk(), "suite serialization doesn't work");
    assert.ok(p2._unsafeUnwrap().equal(p1), "suite serialization doesn't work");

    const f1 = suite.scalar().random();
    const bufff = f1.serialize();
    const f2 = suite.scalar().deserialize(bufff);
    // assert.ok(f2.isOk());
    assert.ok(f2._unsafeUnwrap().equal(f1));
  }).timeout(1000000);

  it("scalar work", async () => {
    const s1 = field.one;
    const s2 = field.one;
    const s3 = field.add(s1, s2);
    const s4 = field.neg(s3);
    // a + (-a) = 0
    const s5 = field.add(s3, s4);
    assert.ok(field.isZero(s5));
  });

  it("point work", async () => {
    const g1 = group.g;
    const f1 = field.random();
    const g2 = group.timesScalar(g1, f1);
    const g3 = group.neg(g2);
    const g4 = group.add(g2, g3);
    assert.ok(group.isZero(g4));
  });

  function pointToEvm(p: Uint8Array): EVMG1Point {
    const obj = group.toObject(group.toAffine(p));
    return { x: BigNumber.from(obj[0]), y: BigNumber.from(obj[1]) };
  }

  function evmToPoint(e: EVMG1Point): Uint8Array {
    return group.fromObject([e.x.toBigInt(), e.y.toBigInt()]);
  }

  function scalarToEvm(s: WasmField1): BigNumber {
    return BigNumber.from(field.toObject(s));
  }

  function evmToScalar(e: BigNumber): WasmField1 {
    return field.fromObject(e.toBigInt());
  }

  // it("Compatibility with rust code", () => {
  //   const jsonObj = {
  //     base: {
  //       compressed:
  //         "0x0100000000000000000000000000000000000000000000000000000000000000",
  //       affine: {
  //         x: "0x0100000000000000000000000000000000000000000000000000000000000000",
  //         y: "0x0200000000000000000000000000000000000000000000000000000000000000",
  //       },
  //     },
  //     p: {
  //       compressed:
  //         "0x09df360bdc70c00e7b59d8e9a81a99da67be41eee07eb511bf1d208c38fe811e",
  //       affine: {
  //         x: "0x09df360bdc70c00e7b59d8e9a81a99da67be41eee07eb511bf1d208c38fe811e",
  //         y: "0x55b801514bf71c9fe72c6dd583f6cb3cc87c21a979c77f435f135a54134d9306",
  //       },
  //     },
  //   };
  //   // compatibility with base point in compressed form
  //   // TODO: Hangs here
  //   let r = suite.point().deserialize(arrayify(jsonObj.base.compressed));
  //   assert.ok(r.isOk());
  //   assert.ok(r._unsafeUnwrap().equal(suite.point().one()));
  //   // compatibility with base point in affine form
  //   const xbase = arrayify(jsonObj.base.affine.x);
  //   const ybase = arrayify(jsonObj.base.affine.y);
  //   r = suite.point().fromXY(xbase, ybase);
  //   assert.ok(r.isOk());
  //   assert.ok(r._unsafeUnwrap().equal(suite.point().one()));
  //
  //   // compatibility with random point in compressed form
  //   r = suite.point().deserialize(arrayify(jsonObj.p.compressed));
  //   assert.ok(r.isOk());
  //   const p1 = r._unsafeUnwrap();
  //   assert.ok(p1.p.isValid() && p1.p.isValidOrder());
  //   // compatibility with random point in affine form
  //   const xp = arrayify(jsonObj.p.affine.x);
  //   const yp = arrayify(jsonObj.p.affine.y);
  //   r = suite.point().fromXY(xp, yp);
  //   assert.ok(r.isOk());
  //   const p2 = r._unsafeUnwrap();
  //   assert.ok(p2.p.isValid() && p2.p.isValidOrder());
  //   console.log(
  //     "p1.x = ",
  //     p1.p.getX().serializeToHexStr(),
  //     " - p1.y = ",
  //     p1.p.getY().serializeToHexStr()
  //   );
  //   console.log(
  //     "p2.x = ",
  //     p2.p.getX().serializeToHexStr(),
  //     " - p2.y = ",
  //     p2.p.getY().serializeToHexStr()
  //   );
  //   assert.ok(p1.equal(p2.neg()));
  //   console.log("random p: ", hexlify(p1.serialize()));
  //   console.log("random -p: ", hexlify(p1.neg().serialize()));
  //   console.log("random p.x: ", hexlify(p1.p.getX().serialize()));
  //   console.log("random p.y: ", hexlify(p1.p.getY().serialize()));
  // });

  it("is compatible with EVM", async () => {
    const [owner] = await ethers.getSigners();
    const testContract = await new Playground__factory(owner).deploy();
    const f = field.random();
    const g = group.timesScalar(group.g, f);
    let evmRes = await testContract.identity(pointToEvm(g));
    let decoded = evmToPoint(evmRes);
    assert.ok(group.eq(decoded, g), "identity check fail");

    // scalar mult
    const gf = group.timesFr(group.g, f);
    evmRes = await testContract.scalarMul(pointToEvm(group.g), scalarToEvm(f));
    decoded = evmToPoint(evmRes);
    assert.ok(group.eq(decoded, gf), "scalar mult failing");

    // point addition
    const sum = group.add(decoded, decoded);
    evmRes = await testContract.pointAdd(
      pointToEvm(decoded),
      pointToEvm(decoded)
    );
    decoded = evmToPoint(evmRes);
    assert.ok(group.eq(decoded, sum), "point addition fail");

    // id scalar
    const evmScalarRes = await testContract.idScalar(scalarToEvm(f));
    const scalar = evmToScalar(evmScalarRes);
    assert.ok(field.eq(f, scalar));
  });

  it("suite works as expected", async () => {
    const [owner] = await ethers.getSigners();
    const testContract = await new Playground__factory(owner).deploy();
    const p1 = suite.point().random();
    let evmRes = await testContract.identity(p1.toEvm());
    assert.ok(
      suite.point().fromEvm(evmRes)._unsafeUnwrap(),
      "suite identity fail"
    );

    const p2 = suite.point().random();
    const p3 = suite.point().set(p2).add(p1);
    evmRes = await testContract.pointAdd(p1.toEvm(), p2.toEvm());
    let decoded = suite.point().fromEvm(evmRes)._unsafeUnwrap();
    assert.ok(p3.equal(decoded), "suite point addition doesn't work");

    const f = suite.scalar().random();
    const p4 = suite.point().set(p1).mul(f);
    evmRes = await testContract.scalarMul(p1.toEvm(), f.toEvm());
    decoded = suite.point().fromEvm(evmRes)._unsafeUnwrap();
    assert.ok(p4.equal(decoded), "scalar mul not working");
  });
});
