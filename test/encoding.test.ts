/* eslint-disable no-unused-expressions */
import { expect } from "chai";
import { ethers } from "hardhat";
import { BigNumber, Contract, Signer } from "ethers";
import {
  IEncryptionOracle,
  TestContract__factory,
} from "../../contracts/typechain";
import { init, curve } from "../src/bn254";
import { newKeypair } from "../src/index";
import { hexlify, randomBytes } from "ethers/lib/utils";

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

  it("decode g1point", async () => {
    const k = {
      x: "0xec60410d6b756865514cbf64796bde8fdcb13eeff05b05d618098bd5b5461e17",
      y: "0x2eaecebdb8c74ac34eca26f8ff0c0b2e4f514478adf29abd65f410983a30682e",
    };
    const xa = ethers.BigNumber.from(k.x);
    const ya = ethers.BigNumber.from(k.y);
    const p = curve.point().fromEvm({ x: xa, y: ya });
    expect(p.isOk()).to.be.true;

    const [owner] = await ethers.getSigners();
    const testContract = await new TestContract__factory(owner).deploy();
    await testContract.setDistributedKey({ x: xa, y: ya });
    const key = await testContract.distributedKey();
    const found = curve.point().fromEvm(key);
    expect(found.isOk()).to.be.true;
    const foundp = found._unsafeUnwrap();
    expect(foundp.equal(p._unsafeUnwrap())).to.be.true;
  });
});
