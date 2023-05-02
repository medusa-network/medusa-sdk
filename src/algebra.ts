import { BigNumber } from 'ethers';
import { EncodingRes, EVMEncoding, ABIEncoder } from './encoding';

export interface Atom<RHS> {
  add(e: this): this;
  mul(r: RHS): this;
  neg(): this;
  zero(): this;
  one(): this;
  random(): this;
  equal(e: this): boolean;
  serialize(): Uint8Array;
  deserialize(p: Uint8Array): EncodingRes<this>;
  set(a: this): this;
}

export interface Scalar
  extends Atom<Scalar>,
  EVMEncoding<BigNumber>,
  ABIEncoder {
  inverse(): this;
}

export interface EVMG1Point {
  x: BigNumber;
  y: BigNumber;
}

export interface Point<S extends Scalar>
  extends Atom<S>,
  EVMEncoding<EVMG1Point>,
  ABIEncoder {
  // setHashOf(m: string): this;
  // fromXY(xbuff: Uint8Array, ybuff: Uint8Array): EncodingRes<this>;
}

// Unfortunately we can not have static methods on scalar
// and points interface so we have to make them available via
// this third type curve.
export interface Curve<S extends Scalar, P extends Point<S>> {
  scalar(): S;
  point(): P;
}
