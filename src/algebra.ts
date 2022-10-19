import { BigNumber } from "ethers";
import { EncodingRes, EVMEncoding } from "./encoding";
import { ToBytes } from "./transcript";

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
      ToBytes {
  inverse(): this;
  /// takes an array of bytes, modulo it to the
  /// the scalar field and return the scalar.
  /// Different than deserialize which panics if the
  /// scalar is not in the right range. THis method
  /// is to be used to create arrays from any streams
  /// of bytes (think transcript hashing).
  fromBytes(array: Uint8Array): this;
}

export interface EVMPoint {
  x: BigNumber;
  y: BigNumber;
}

export interface Point<S extends Scalar>
  extends Atom<S>,
    EVMEncoding<EVMPoint> {
  setHashOf(m: string): this;
  fromXY(xbuff: Uint8Array, ybuff: Uint8Array): EncodingRes<this>;
}

// Unfortunately we can not have static methods on scalar
// and points interface so we have to make them available via
// this third type curve.
export interface Curve<S extends Scalar, P extends Point<S>> {
  scalar(): S;
  point(): P;
}
