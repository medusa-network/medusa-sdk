import { BigNumber } from "ethers";
import { ok, err } from "neverthrow";
import { Point, Scalar, Curve } from "./algebra";
import { EncodingRes, EVMEncoding } from "./encoding";
import { Transcript } from "./transcript";

/// Suite needed by the dleq module: must use two distinct base where we don't know the 
/// dlog of each.
export interface DleqSuite<S extends Scalar, P extends Point<S>> extends Curve<S,P> {
    base1(): P;
    base2(): P;
}
export class Proof<S extends Scalar> implements EVMEncoding<EVMProof> {
    // f = t + e*s
    f: S;
    // challenge e = H( ... )
    e: S;

    constructor(f: S, e: S) {
        this.f = f;
        this.e = e;
    }

    static default<S extends Scalar, P extends Point<S>>(c: Curve<S,P>): Proof<S> {
        return new Proof(c.scalar(),c.scalar());
    }

    fromEvm(t: EVMProof): EncodingRes<this> {
        return this.f.fromEvm(t.f)
            .andThen((f) => {
                this.f = f;
                return this.e.fromEvm(t.e)
            }).andThen((e) => { 
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

/// The EVM encoding of Proof
export type EVMProof = {
    f: BigNumber;
    e: BigNumber;
}

/// creates a DLEQ proof between r*G1 and r*G2
export function prove<S extends Scalar, 
        P extends Point<S>,
        Suite extends DleqSuite<S,P>,
        T extends Transcript>(suite: Suite, tr: T, 
            // rg1= r*G1, rg2 = r*G2
            secret: S, rg1: P, rg2: P): Proof<S> {
            let t = suite.scalar().random();
            // w1 = t*G1, w2 = t*G2
            let w1 = suite.base1().mul(t);
            let w2 = suite.base2().mul(t);
            let challenge :S = tr.challengeFrom([rg1,rg2,w1,w2],suite.scalar());
            // f = t - challenge * r
            let f = t.add(suite.scalar().set(challenge).mul(secret).neg());
            return new Proof(f,challenge);
}

export function verify<S extends Scalar,
    P extends Point<S>,
    Suite extends DleqSuite<S,P>,
    T extends Transcript>(suite: Suite, tr: T,
    rg1: P, rg2: P, proof: Proof<S>): boolean {
        // w1 = f*G1 + rG1 * e
        let w1 = suite.base1().mul(proof.f).add(suite.point().set(rg1).mul(proof.e)); 
        // w2 = f*G2 + rG2 * e
        let w2  = suite.base2().mul(proof.f).add(suite.point().set(rg2).mul(proof.e)); 
        let challenge :S  = tr.challengeFrom([rg1,rg2,w1,w2],suite.scalar());
        if (challenge.equal(proof.e)) {
            return true;
        }
        return false;
}