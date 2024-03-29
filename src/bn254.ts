import { buildBn128, WasmCurve, WasmField1 } from 'ffjavascript';
import { ok, err } from 'neverthrow';
import { BigNumber } from 'ethers';

import { Curve, Atom, Scalar, Point, EVMG1Point } from './algebra';
import {
  EncodingRes,
  EncodingError,
  EVMEncoding,
  ABIEncoder,
  ABIEncoded,
} from './encoding';
import { ToBytes } from '../src/transcript';
import { DleqSuite } from './dleq';

let IG1: WasmCurve;
let IFr: WasmField1;

/// Initiatlization of the suite and some constants
export async function init(): Promise<Bn254Suite> {
  // Only build curve once
  globalThis.ffCurve ||= await buildBn128();
  IG1 = globalThis.ffCurve.G1;
  IFr = globalThis.ffCurve.Fr;
  return new Bn254Suite();
}

export class Fr implements Atom<Fr>, Scalar, EVMEncoding<BigNumber>, ABIEncoder {
  f: WasmField1;

  constructor() {
    this.f = IFr.zero;
  }

  abiEncode(): ABIEncoded {
    return [['uint256'], [this.toEvm()]];
  }

  add(e: Fr): this {
    this.f = IFr.add(this.f, e.f);
    return this;
  }

  mul(e: Fr): this {
    this.f = IFr.mul(this.f, e.f);
    return this;
  }

  neg(): this {
    this.f = IFr.neg(this.f);
    return this;
  }

  inverse(): this {
    this.f = IFr.inv(this.f);
    return this;
  }

  zero(): this {
    this.f = IFr.zero;
    return this;
  }

  random(): this {
    this.f = IFr.random();
    return this;
  }

  one(): this {
    this.f = IFr.one;
    return this;
  }

  equal(e: Fr): boolean {
    return IFr.eq(this.f, e.f);
  }

  serialize(): Uint8Array {
    const buff = new Uint8Array(32);
    IFr.toRprLE(buff, 0, this.f);
    return buff;
  }

  deserialize(buff: Uint8Array): EncodingRes<this> {
    this.f = IFr.fromRprLE(buff, 0);
    return ok(this);
  }

  set(e: Fr): this {
    const arr = e.serialize();
    this.deserialize(arr)._unsafeUnwrap();
    return this;
  }

  toEvm(): BigNumber {
    const obj = IFr.toObject(this.f);
    return BigNumber.from(obj);
  }

  fromEvm(t: BigNumber): EncodingRes<this> {
    this.f = IFr.fromObject(t.toBigInt());
    return ok(this);
  }
}

export class G1
  implements Point<Fr>, Atom<Fr>, EVMEncoding<EVMG1Point>, ABIEncoder, ToBytes
{
  p: Uint8Array;

  constructor() {
    this.p = IG1.g;
  }

  abiEncode(): ABIEncoded {
    const evm = this.toEvm();
    return [
      ['uint256', 'uint256'],
      [evm.x, evm.y],
    ];
  }

  add(e: G1): this {
    this.p = IG1.add(this.p, e.p);
    return this;
  }

  mul(e: Fr): this {
    this.p = IG1.timesFr(this.p, e.f);
    return this;
  }

  neg(): this {
    this.p = IG1.neg(this.p);
    return this;
  }

  zero(): this {
    this.p = IG1.zero;
    return this;
  }

  random(): this {
    const f = IFr.random();
    this.p = IG1.timesFr(IG1.g, f);
    // this.p = IG1.fromRng(utils.getThreadRng());
    return this;
  }

  // not yet available
  // setHashOf(m: string): this {
  //   this.p.setHashOf(m);
  //   return this;
  // }

  one(): this {
    this.p = IG1.g;
    return this;
  }

  equal(e: G1): boolean {
    return IG1.eq(this.p, e.p);
  }

  serialize(): Uint8Array {
    const buff = new Uint8Array(64);
    IG1.toRprCompressed(buff, 0, IG1.toAffine(this.p));
    return buff;
  }

  deserialize(buff: Uint8Array): EncodingRes<this> {
    this.p = IG1.fromRprCompressed(buff, 0);
    if (!IG1.isValid(this.p)) {
      return err(new EncodingError('invalid point'));
    }
    return ok(this);
  }

  set(e: G1): this {
    const arr = e.serialize();
    this.deserialize(arr)._unsafeUnwrap();
    return this;
  }

  toEvm(): EVMG1Point {
    const obj = IG1.toObject(IG1.toAffine(this.p));
    return { x: BigNumber.from(obj[0]), y: BigNumber.from(obj[1]) };
  }

  fromEvm(p: EVMG1Point): EncodingRes<this> {
    this.p = IG1.fromObject([p.x.toBigInt(), p.y.toBigInt()]);
    // XXX Not checking since it doesn't work the isZero function does not
    // work as intended. Anyway, since it's coming from EVM we can
    // be pretty sure the point is gonna be on the curve, since the contract
    // checks the dleq proof
    // console.log("bytelength => ", this.p.byteLength, " vs normal ", new G1().random().p.byteLength, " vs library ", IG1.F.n8 * 2);
    if (!IG1.isValid(this.p)) {
      return err(new EncodingError('invalid point'));
    }
    return ok(this);
  }
}

export class Bn254Suite implements Curve<Fr, G1>, DleqSuite<Fr, G1> {
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
    const x = BigNumber.from(
      '5671920232091439599101938152932944148754342563866262832106763099907508111378',
    ).toBigInt();
    const y = BigNumber.from(
      '2648212145371980650762357218546059709774557459353804686023280323276775278879',
    ).toBigInt();
    const ibase2 = IG1.fromObject([x, y]);
    IG1.isValid(ibase2);
    const base2 = new G1();
    base2.p = ibase2;
    return base2;
  }
}
