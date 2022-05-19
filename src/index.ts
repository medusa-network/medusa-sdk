import { Point, Scalar, Curve, Atom } from "./algebra";

export type PublicKey<S extends Scalar> = Point<S>;
export type SecretKey = Scalar;

export interface KeyPair<S extends Scalar, P extends Point<Scalar>> {
  secret: S;
  pubkey: P;
}

export function newKeypair<
  S extends Scalar,
  P extends Point<S>,
  C extends Curve<S, P>
>(c: C): KeyPair<S, P> {
  const priv = c.scalar().random();
  const pubkey = c.point().mul(priv);
  const kp: KeyPair<S, P> = {
    secret: priv,
    pubkey: pubkey,
  };
  return kp;
}

export function foo(a: number, b: number): number {
  return a + b;
}
