import assert from 'assert';
import { BigNumber, utils } from '../src/ethers-compat';
import { buildBn128, WasmCurve, WasmField1 } from 'ffjavascript';
import { ethers } from 'hardhat';
/* eslint-disable-next-line camelcase */
import { Playground__factory } from '../typechain';
import { init, Bn254Suite } from '../src/bn254';
import { EVMG1Point } from '../src/algebra';
import { expect } from 'chai';
import { convertBigIntToBigNumber, convertBigNumberToBigInt } from './test-utils';

describe('use ident', async () => {
  let group: WasmCurve;
  let field: WasmField1;
  let suite: Bn254Suite;

  before(async () => {
    suite = await init();
    const bn128 = await buildBn128();
    group = bn128.G1;
    field = bn128.Fr;
  });

  // it("show bases", () => {
  //   const baseString = "MEDUSA_DLEQ_BN254_BASE2";
  //   const p = suite.point().setHashOf(baseString);
  //   const e = p.toEvm();
  //   console.log(baseString);
  //   console.log("x:", e.x.toString());
  //   console.log("y:", e.y.toString());
  // });

  it('suite serialization works', async () => {
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

  it('scalar work', async () => {
    const s1 = field.one;
    const s2 = field.one;
    const s3 = field.add(s1, s2);
    const s4 = field.neg(s3);
    // a + (-a) = 0
    const s5 = field.add(s3, s4);
    assert.ok(field.isZero(s5));
  });

  it('point work', async () => {
    const g1 = group.g;
    const f1 = field.random();
    const g2 = group.timesScalar(g1, f1);
    const g3 = group.neg(g2);
    const g4 = group.add(g2, g3);
    assert.ok(group.isZero(g4));
  });

  function pointToEvm(p: Uint8Array): EVMG1Point {
    const obj = group.toObject(group.toAffine(p));
    return { x: BigNumber.from(obj[0].toString()), y: BigNumber.from(obj[1].toString()) };
  }

  function evmToPoint(e: EVMG1Point): Uint8Array {
    return group.fromObject([BigInt(e.x.toString()), BigInt(e.y.toString())]);
  }

  function scalarToEvm(s: WasmField1): BigNumber {
    return BigNumber.from(field.toObject(s).toString());
  }

  function evmToScalar(e: BigNumber): WasmField1 {
    return field.fromObject(BigInt(e.toString()));
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

  it('is compatible with EVM', async () => {
    const [owner] = await ethers.getSigners();
    const testContract = await new Playground__factory(owner).deploy();
    const f = field.random();
    const g = group.timesScalar(group.g, f);
    
    // Convert to bigint for contract call
    const evmG = pointToEvm(g);
    const contractG = {
      x: evmG.x.toBigInt(),
      y: evmG.y.toBigInt()
    };
    const evmRes = await testContract.identity(contractG);
    
    // Convert result back to BigNumber
    const evmResCompat = {
      x: BigNumber.from(evmRes.x.toString()),
      y: BigNumber.from(evmRes.y.toString())
    };
    const decoded = evmToPoint(evmResCompat);
    assert.ok(group.eq(decoded, g), 'identity check fail');

    // scalar mult
    const gf = group.timesFr(group.g, f);
    const evmF = scalarToEvm(f);
    const contractGBase = {
      x: pointToEvm(group.g).x.toBigInt(),
      y: pointToEvm(group.g).y.toBigInt()
    };
    const contractF = evmF.toBigInt();
    const evmMulRes = await testContract.scalarMul(contractGBase, contractF);
    
    // Convert result back to BigNumber
    const evmMulResCompat = {
      x: BigNumber.from(evmMulRes.x.toString()),
      y: BigNumber.from(evmMulRes.y.toString())
    };
    const decodedMul = evmToPoint(evmMulResCompat);
    assert.ok(group.eq(decodedMul, gf), 'scalar mult failing');

    // point addition
    const sum = group.add(decoded, decoded);
    const contractDecoded = {
      x: pointToEvm(decoded).x.toBigInt(),
      y: pointToEvm(decoded).y.toBigInt()
    };
    const evmAddRes = await testContract.pointAdd(contractDecoded, contractDecoded);
    
    // Convert result back to BigNumber
    const evmAddResCompat = {
      x: BigNumber.from(evmAddRes.x.toString()),
      y: BigNumber.from(evmAddRes.y.toString())
    };
    const decodedAdd = evmToPoint(evmAddResCompat);
    assert.ok(group.eq(decodedAdd, sum), 'point addition fail');

    // id scalar
    const contractScalar = scalarToEvm(f).toBigInt();
    const evmScalarRes = await testContract.idScalar(contractScalar);
    
    // Convert result back to BigNumber
    const evmScalarResCompat = BigNumber.from(evmScalarRes.toString());
    const scalar = evmToScalar(evmScalarResCompat);
    assert.ok(field.eq(f, scalar));
  });

  it('suite works as expected', async () => {
    const [owner] = await ethers.getSigners();
    const testContract = await new Playground__factory(owner).deploy();
    const p1 = suite.point().random();
    
    // Convert to bigint for contract call
    const p1Evm = p1.toEvm();
    const contractP1 = {
      x: p1Evm.x.toBigInt(),
      y: p1Evm.y.toBigInt()
    };
    const evmRes = await testContract.identity(contractP1);
    
    // Convert result back to BigNumber
    const evmResCompat = {
      x: BigNumber.from(evmRes.x.toString()),
      y: BigNumber.from(evmRes.y.toString())
    };
    const decoded = suite.point().fromEvm(evmResCompat)._unsafeUnwrap();
    assert.ok(p1.equal(decoded), 'suite identity fail');

    const p2 = suite.point().random();
    const p3 = suite.point().set(p2).add(p1);
    
    // Convert to bigint for contract call
    const p1EvmForAdd = p1.toEvm();
    const p2Evm = p2.toEvm();
    const contractP1ForAdd = {
      x: p1EvmForAdd.x.toBigInt(),
      y: p1EvmForAdd.y.toBigInt()
    };
    const contractP2 = {
      x: p2Evm.x.toBigInt(),
      y: p2Evm.y.toBigInt()
    };
    const evmAddRes = await testContract.pointAdd(contractP1ForAdd, contractP2);
    
    // Convert result back to BigNumber
    const evmAddResCompat = {
      x: BigNumber.from(evmAddRes.x.toString()),
      y: BigNumber.from(evmAddRes.y.toString())
    };
    const decodedAdd = suite.point().fromEvm(evmAddResCompat)._unsafeUnwrap();
    assert.ok(p3.equal(decodedAdd), "suite point addition doesn't work");

    const f = suite.scalar().random();
    const p4 = suite.point().set(p1).mul(f);
    
    // Convert to bigint for contract call
    const p1EvmForMul = p1.toEvm();
    const fEvm = f.toEvm();
    const contractP1ForMul = {
      x: p1EvmForMul.x.toBigInt(),
      y: p1EvmForMul.y.toBigInt()
    };
    const contractF = fEvm.toBigInt();
    const evmMulRes = await testContract.scalarMul(contractP1ForMul, contractF);
    
    // Convert result back to BigNumber
    const evmMulResCompat = {
      x: BigNumber.from(evmMulRes.x.toString()),
      y: BigNumber.from(evmMulRes.y.toString())
    };
    const decodedMul = suite.point().fromEvm(evmMulResCompat)._unsafeUnwrap();
    assert.ok(p4.equal(decodedMul), 'scalar mul not working');
  });

  it('should test the contract', async () => {
    const [owner] = await ethers.getSigners();
    const test = await new Playground__factory(owner).deploy();
    const suite = await init();
    
    const p1 = suite.point().random();
    const p1Evm = p1.toEvm();
    
    // Convert to bigint for contract call
    const contractP1 = {
      x: p1Evm.x.toBigInt(),
      y: p1Evm.y.toBigInt()
    };
    const p1Res = await test.identity(contractP1);
    
    // Convert result back to BigNumber
    const p1ResCompat = {
      x: BigNumber.from(p1Res.x.toString()),
      y: BigNumber.from(p1Res.y.toString())
    };
    assert.deepStrictEqual(p1ResCompat, p1Evm);
  });
});
