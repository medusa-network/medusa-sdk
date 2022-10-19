import { Point, Scalar, Curve } from "./algebra";
import { Transcript } from "./transcript";

/// Suite needed by the dleq module: must use two distinct base where we don't know the 
/// dlog of each.
export interface DleqSuite<S extends Scalar, P extends Point<S>> extends Curve<S,P> {
    base1(): P;
    base2(): P;
}
export interface Proof<S extends Scalar> {
    // f = t + e*s
    f: S;
    // challenge e = H( ... )
    e: S;
}

export function prove<S extends Scalar, 
        P extends Point<S>,
        Suite extends DleqSuite<S,P>,
        T extends Transcript<S>>(suite: Suite, tr: T, secret: S) {
            // rg1= r*G1, rg2 = r*G2
            let rg1 = suite.base1().mul(secret);
            let rg2 = suite.base2().mul(secret);
            let t = suite.scalar().random();
            // w1 = t*G1, w2 = t*G2
            let w1 = suite.base1().mul(t);
            let w2 = suite.base2().mul(t);
            let challenge :S = tr.challengeFrom([rg1,rg2,w1,w2],suite.scalar());
            // f = t - challenge * r
            let f = t.add(suite.scalar().set(challenge).mul(secret).neg());
            return { 
                f: f,
                e: challenge,
            };

}

export function verify<S extends Scalar,
    P extends Point<S>,
    Suite extends DleqSuite<S,P>,
    T extends Transcript<S>>(suite: Suite, tr: T,
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