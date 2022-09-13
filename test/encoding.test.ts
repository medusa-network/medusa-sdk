/* eslint-disable no-unused-expressions */
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import { IEncryptionOracle, TestContract__factory } from "../typechain";
import { init, curve } from "../src/bn254";
import { newKeypair } from "../src/index";
import { hexlify, arrayify, randomBytes } from "ethers/lib/utils";
import { arrayToBn, bnToArray } from "../src/utils";
import assert from "assert";

describe("Test Encoding ", function () {
  before(async () => {
    await init();
  });

  it("local encoding & decoding curve", () => {
    const s = curve.scalar().random();
    const p = curve.point().random();
    const sevm = s.toEvm();
    const pevm = p.toEvm();
    const sfound = curve.scalar().fromEvm(sevm);
    expect(sfound.isOk()).to.be.true;
    expect(sfound._unsafeUnwrap().equal(s)).to.be.true;
    const pfound = curve.point().fromEvm(pevm);
    expect(pfound.isOk()).to.be.true;
    expect(pfound._unsafeUnwrap().equal(p)).to.be.true;
  });

  it("encoding g1point evm", async () => {
    const [owner] = await ethers.getSigners();
    const test = await new TestContract__factory(owner).deploy();
    const random = curve.point().random();
    // generate random 32 byte bigint
    const value = randomBytes(32); // 32 bytes = 256 bits
    const cipher = BigNumber.from(hexlify(value));
    await test.logCipher(1, { random: random.toEvm(), cipher: cipher });
    const filter = test.filters.NewLogCipher(1);
    const logs = await test.queryFilter(filter, 0);
    expect(logs.length).to.be.eq(1);
    const event = logs[0].args;
    expect(event.id).to.be.eq(1);
    expect(event.cipher).to.be.eq(cipher);
    const r = curve.point().fromEvm({ x: event.rx, y: event.ry });
    expect(r.isOk()).to.be.true;
    expect(r._unsafeUnwrap().equal(random)).to.be.true;
  });

  it("non-aligned values from EVM are zero-padded to 32 bytes", () => {
    const x = BigNumber.from(
      "69433070941023771994177046973345245040155856504302196671035682426544325470"
    );
    const y = BigNumber.from(
      "3933316350851654905519662377468250369417328085252457770283816391639153292475"
    );

    // Note: Errors if values are not deserialized correctly to 32-bytes
    curve.point().fromEvm({ x, y });
  });

  it("decode g1point", async () => {
    const point = curve.point().random();
    const [owner] = await ethers.getSigners();
    const testContract = await new TestContract__factory(owner).deploy();
    const res = await testContract.setDistributedKey(point.toEvm());
    const receipt = await res.wait();
    assert.strictEqual(receipt.status, 1);
    const key = await testContract.distributedKey();
    const found = curve.point().fromEvm(key);
    expect(found.isOk()).to.be.true;
    const foundp = found._unsafeUnwrap();
    expect(foundp.equal(point)).to.be.true;
  });

  it("produce g1point for ruse", async () => {
    const s = curve.scalar().random();
    const p = curve.point().one().mul(s);
    const shex = s.toEvm();
    const phex = p.toEvm();
    const obj = {
      s: shex.toHexString(),
      p: {
        x: phex.x.toHexString(),
        y: phex.y.toHexString(),
      },
    };
    console.log(JSON.stringify(obj, null, 2));
  });
});
