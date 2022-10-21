import { Curve, Atom, Scalar, Point, EVMG1Point } from "./algebra";

import { EncodingRes, EncodingError, EVMEncoding, ABIEncoder } from "./encoding";
import * as mcl from "mcl-wasm";
import { randHex, onlyZero, bnToArray, arrayToBn } from "./utils";
import { ok, err } from "neverthrow";
import { BigNumber } from "ethers";
import { ToBytes } from "../src/transcript";
import { DleqSuite } from "./dleq";
import { G2 } from "mcl-wasm";

/// Initiatlization of the suite and some constants
export async function init(): Promise<void> {
  await mcl.init(mcl.BN_SNARK1);
  //mcl.setMapToMode(mcl.BN254);
  suite = new Bn254Suite(new G1().random());
  //suite = new Bn254Suite(new G1().fromEvm(new EVMG1Point(
  //  // x
  //  BigNumber.from("5671920232091439599101938152932944148754342563866262832106763099907508111378"),
  //  // y
  //  BigNumber.from("2648212145371980650762357218546059709774557459353804686023280323276775278879"),
  //))._unsafeUnwrap());
}

export class Fr
  implements Atom<Fr>,
  Scalar,
  EVMEncoding<BigNumber>,
  ABIEncoder {
  f: mcl.Fr;
  constructor() {
    this.f = new mcl.Fr();
  }

  abiEncode(): [Array<string>, Array<any>] {
    return [["uint256"], [this.f.serialize()]];
  }

  add(e: Fr): this {
    this.f = mcl.add(this.f, e.f);
    return this;
  }

  mul(e: Fr): this {
    this.f = mcl.mul(this.f, e.f);
    return this;
  }

  neg(): this {
    this.f = mcl.neg(this.f);
    return this;
  }

  inverse(): this {
    this.f = mcl.inv(this.f);
    return this;
  }

  zero(): this {
    this.f.setInt(0);
    return this;
  }

  random(): this {
    this.f.setByCSPRNG();
    return this;
  }

  one(): this {
    this.f.setInt(1);
    return this;
  }

  equal(e: Fr): boolean {
    return this.f.isEqual(e.f);
  }

  serialize(): Uint8Array {
    return this.f.serialize();
  }

  deserialize(buff: Uint8Array): EncodingRes<this> {
    this.f.deserialize(buff);
    // ??? no valid functions ???
    return ok(this);
  }

  fromBytes(array: Uint8Array): this {
    this.f.setLittleEndianMod(array);
    return this;
  }

  set(e: Fr): this {
    const arr = e.f.serialize();
    this.deserialize(arr)._unsafeUnwrap();
    return this;
  }

  toEvm(): BigNumber {
    return arrayToBn(this.f.serialize());
  }

  fromEvm(t: BigNumber): EncodingRes<this> {
    this.f.deserialize(bnToArray(t));
    return ok(this);
  }
}

export class G1 implements Point<Fr>, Atom<Fr>, EVMEncoding<EVMG1Point>, ABIEncoder, ToBytes {
  p: mcl.G1;
  constructor() {
    this.p = new mcl.G1();
  }
  abiEncode(): [Array<string>, Array<any>] {
    let evm = this.toEvm();
    let xarray = bnToArray(evm.x, false, 32);
    let yarray = bnToArray(evm.y, false, 32);
    return [["uint256", "uint256"], [xarray, yarray]];
  }
  add(e: G1): this {
    this.p = mcl.add(this.p, e.p);
    return this;
  }

  mul(e: Fr): this {
    this.p = mcl.mul(this.p, e.f);
    return this;
  }

  neg(): this {
    this.p = mcl.neg(this.p);
    return this;
  }

  zero(): this {
    return this;
  }

  random(): this {
    const random = randHex(32);
    return this.setHashOf(random);
  }

  setHashOf(m: string): this {
    this.p.setHashOf(m);
    return this;
  }

  one(): this {
    this.p.setStr("1 0x01 0x02", 16);
    return this;
  }

  equal(e: G1): boolean {
    this.p.normalize();
    e.p.normalize();
    return this.p.isEqual(e.p);
  }

  serialize(): Uint8Array {
    this.p.normalize();
    return this.p.serialize();
  }

  deserialize(buff: Uint8Array): EncodingRes<this> {
    this.p.deserialize(buff);
    if (!this.p.isValid()) {
      return err(new EncodingError("invalid point"));
    }
    return ok(this);
  }

  set(e: G1): this {
    const arr = e.p.serialize();
    this.deserialize(arr)._unsafeUnwrap();
    return this;
  }

  fromXY(xbuff: Uint8Array, ybuff: Uint8Array): EncodingRes<this> {
    if (onlyZero(xbuff)) {
      this.p.setStr("1 0x00 0x01");
      return ok(this);
    }
    const x = new mcl.Fp();
    x.deserialize(xbuff);
    this.p.setX(x);

    const y = new mcl.Fp();
    y.deserialize(ybuff);
    this.p.setY(y);

    const z = new mcl.Fp();
    z.setInt(1);
    this.p.setZ(z);

    if (!this.p.isValid() || !this.p.isValidOrder()) {
      return err(new EncodingError("invalid x y coordinates"));
    }
    return ok(this);
  }

  toEvm(): EVMG1Point {
    this.p.normalize();
    const x = BigNumber.from(this.p.getX().serialize().reverse());
    const y = BigNumber.from(this.p.getY().serialize().reverse());
    return new EVMG1Point(x, y);
  }

  fromEvm(p: EVMG1Point): EncodingRes<this> {
    const x = bnToArray(p.x, true, 32);
    const y = bnToArray(p.y, true, 32);
    return this.fromXY(x, y);
  }
}
class Bn254Suite implements Curve<Fr, G1>, DleqSuite<Fr, G1> {
  _base2: G1;

  constructor(base2: G1) {
    this._base2 = base2;
  }
  scalar(): Fr {
    return new Fr();
  }

  point(): G1 {
    return new G1();
  }

  base1(): G1 {
    return new G1().one();
  }

  base2(): G1 {
    return new G1().set(this._base2);
  }
}

let suite: Bn254Suite;
export { suite };
