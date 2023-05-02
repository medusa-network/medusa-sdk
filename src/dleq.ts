import { BigNumber } from 'ethers';
import { ok } from 'neverthrow';
import { Point, Scalar, Curve } from './algebra';
import { EncodingRes, EVMEncoding } from './encoding';
import { EVMTranscript } from './transcript';

/// Suite needed by the dleq module: must use two distinct base where we don't know the
/// dlog of each.
export interface DleqSuite<S extends Scalar, P extends Point<S>>
  extends Curve<S, P> {
  base1(): P;
  base2(): P;
}

/// The EVM encoding of Proof
export type EVMProof = {
  f: BigNumber;
  e: BigNumber;
};

export class Proof<S extends Scalar> implements EVMEncoding<EVMProof> {
  // f = t + e*s
  f: S;
  // challenge e = H( ... )
  e: S;

  constructor(f: S, e: S) {
    this.f = f;
    this.e = e;
  }

  static default<S extends Scalar, P extends Point<S>>(
    c: Curve<S, P>,
  ): Proof<S> {
    return new Proof(c.scalar(), c.scalar());
  }

  fromEvm(t: EVMProof): EncodingRes<this> {
    return this.f
      .fromEvm(t.f)
      .andThen((f) => {
        this.f = f;
        return this.e.fromEvm(t.e);
      })
      .andThen((e) => {
        this.e = e;
        return ok(this);
      });
  }

  toEvm(): EVMProof {
    return {
      f: this.f.toEvm(),
      e: this.e.toEvm(),
    };
  }
}

/// creates a DLEQ proof between r*G1 and r*G2
export function prove<
  S extends Scalar,
  P extends Point<S>,
  Suite extends DleqSuite<S, P>,
  T extends EVMTranscript,
  >(
    suite: Suite,
    tr: T,
    // rg1= r*G1, rg2 = r*G2
    secret: S,
    rg1: P,
    rg2: P,
): Proof<S> {
  const t = suite.scalar().random();
  // w1 = t*G1, w2 = t*G2
  const w1 = suite.base1().mul(t);
  const w2 = suite.base2().mul(t);
  console.log('local w1 -> ', w1.toEvm().x.toString());
  console.log('local w2 -> ', w2.toEvm().x.toString());
  const challenge: S = tr
    .append(rg1)
    .append(rg2)
    .append(w1)
    .append(w2)
    .challenge(suite.scalar());
  // f = t - challenge * r
  const f = t.add(suite.scalar().set(challenge).mul(secret).neg());
  return new Proof(f, challenge);
}

export function verify<
  S extends Scalar,
  P extends Point<S>,
  Suite extends DleqSuite<S, P>,
  T extends EVMTranscript,
  >(suite: Suite, tr: T, rg1: P, rg2: P, proof: Proof<S>): boolean {
  // w1 = f*G1 + rG1 * e
  const w1 = suite
    .base1()
    .mul(proof.f)
    .add(suite.point().set(rg1).mul(proof.e));
  // w2 = f*G2 + rG2 * e
  const w2 = suite
    .base2()
    .mul(proof.f)
    .add(suite.point().set(rg2).mul(proof.e));
  const challenge: S = tr
    .append(rg1)
    .append(rg2)
    .append(w1)
    .append(w2)
    .challenge(suite.scalar());
  if (challenge.equal(proof.e)) {
    return true;
  }
  return false;
}
