/* eslint-disable no-unused-expressions */
import { expect } from 'chai';
import { ethers } from 'hardhat';
import { BigNumber, utils } from '../src/ethers-compat';
/* eslint-disable-next-line camelcase */
import { Playground__factory } from '../typechain';
import { Proof as DleqProof } from '../src/dleq';
import { Bn254Suite, init } from '../src/bn254';
import assert from 'assert';
import { convertBigIntToBigNumber, convertBigNumberToBigInt } from './test-utils';

describe('Encoding', () => {
  let suite: Bn254Suite;

  before(async () => {
    suite = await init();
  });

  it('should encode and decode a proof', async () => {
    const f = suite.scalar().random();
    const e = suite.scalar().random();
    const proof = new DleqProof(f, e);
    const evmProof = proof.toEvm();
    const decoded = new DleqProof(suite.scalar(), suite.scalar()).fromEvm(
      evmProof,
    );
    assert.ok(decoded.isOk());
    const decodedProof = decoded._unsafeUnwrap();
    assert.ok(f.equal(decodedProof.f));
    assert.ok(e.equal(decodedProof.e));
  });

  it('should encode and decode a point', async () => {
    const [owner] = await ethers.getSigners();
    const test = await new Playground__factory(owner).deploy();
    const curve = await init();
    const random = curve.point().random();
    
    // Convert to bigint for contract call
    const randomEvm = random.toEvm();
    const contractRandom = {
      x: randomEvm.x.toBigInt(),
      y: randomEvm.y.toBigInt()
    };
    
    // Use the identity function to test point encoding/decoding
    const result = await test.identity(contractRandom);
    
    // Convert result back to BigNumber
    const resultCompat = {
      x: BigNumber.from(result.x.toString()),
      y: BigNumber.from(result.y.toString())
    };
    
    assert.deepStrictEqual(resultCompat.x, randomEvm.x);
    assert.deepStrictEqual(resultCompat.y, randomEvm.y);
  });

  it('should test point addition in the contract', async () => {
    const [owner] = await ethers.getSigners();
    const test = await new Playground__factory(owner).deploy();
    const curve = await init();
    const p1 = curve.point().random();
    const p2 = curve.point().random();
    const p3 = curve.point().set(p1).add(p2);
    
    // Convert to bigint for contract call
    const p1Evm = p1.toEvm();
    const p2Evm = p2.toEvm();
    const contractP1 = {
      x: p1Evm.x.toBigInt(),
      y: p1Evm.y.toBigInt()
    };
    const contractP2 = {
      x: p2Evm.x.toBigInt(),
      y: p2Evm.y.toBigInt()
    };
    
    // Use the pointAdd function
    const result = await test.pointAdd(contractP1, contractP2);
    
    // Convert result back to BigNumber
    const resultCompat = {
      x: BigNumber.from(result.x.toString()),
      y: BigNumber.from(result.y.toString())
    };
    
    // Verify the result
    const resultPoint = curve.point().fromEvm(resultCompat)._unsafeUnwrap();
    assert.ok(p3.equal(resultPoint), "Point addition doesn't match");
  });
});
