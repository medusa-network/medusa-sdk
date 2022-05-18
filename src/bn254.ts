import {
  Curve,
  Atom,
  Scalar,
  Point,
  EncodingRes,
  EncodingError,
} from "./algebra";
import * as mcl from "mcl-wasm";
import { randHex, onlyZero } from "./utils";
import { ok, err, Result } from "neverthrow";

export async function init() {
  await mcl.init(mcl.BN_SNARK1);
  mcl.setMapToMode(mcl.BN254);
}

export class Fr implements Atom<Fr>, Scalar {
  f: mcl.Fr;
  constructor() {
    this.f = new mcl.Fr();
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
  set(e: Fr): this {
    const arr = e.f.serialize();
    this.deserialize(arr)._unsafeUnwrap();
    return this;
  }
}

export class G1 implements Point<Fr>, Atom<Fr> {
  p: mcl.G1;
  constructor() {
    this.p = new mcl.G1();
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
    return this.map(random);
  }
  map(m: string): this {
    this.p.setHashOf(m);
    return this;
  }
  one(): this {
    //this.p = mcl.getBasePointG1();
    this.p.setStr("1 0x01 0x02", 16);
    return this;
  }
  equal(e: G1): boolean {
    return this.p.isEqual(e.p);
  }
  serialize(): Uint8Array {
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
  from_xy(xbuff: Uint8Array, ybuff: Uint8Array): EncodingRes<this> {
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

    if (!this.p.isValid()) {
      return err(new EncodingError("invalid x y coordinates"));
    }
    return ok(this);
  }
}

class Bn254Curve implements Curve<Fr, G1> {
  scalar(): Fr {
    return new Fr();
  }
  point(): G1 {
    return new G1();
  }
}

const curve = new Bn254Curve();
export { curve };
