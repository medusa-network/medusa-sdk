import { Result } from "neverthrow";
// from https://bobbyhadz.com/blog/typescript-extend-error-class
export class EncodingError extends Error {
  statusCode = 400;

  constructor(message: string) {
    super(message);
    Object.setPrototypeOf(this, EncodingError.prototype);
  }
  getErrorMessage() {
    return "encoding err: " + this.message;
  }
}

export type EncodingRes<T> = Result<T, EncodingError>;

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

export interface Scalar extends Atom<Scalar> {
  inverse(): this;
  //from_evm(u: string): EncodingRes<this>;
  //to_evm(): number;
}

export interface Point<S extends Scalar> extends Atom<S> {
  map(m: string): this;
  from_xy(xbuff: Uint8Array, ybuff: Uint8Array): EncodingRes<this>;
}

// Unfortunately we can not have static methods on scalar
// and points interface so we have to make them available via
// this third type curve.
export interface Curve<S extends Scalar, P extends Point<Scalar>> {
  scalar(): S;
  point(): P;
}
