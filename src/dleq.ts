import { Point, Scalar, Curve } from "./algebra";
import { Transcript } from "./transcript";

export interface Proof<S extends Scalar> {
    // f = t + e*s
    f: S;
    // challenge e = H( ... )
    e: S;
}

export function prove<S extends Scalar, 
        P extends Point<S>,
        C extends Curve<S,P>,
        T extends Transcript<S>>(curve: C, tr: T, base1 :P, base2: P,secret: S) {
            let rg1 = base1.mul(secret);
            let rg2 = base2.mul(secret);
            let t = curve.scalar().random();
            let w = base1.mul(t);
            let wp = base2.mul(t);
            let challenge :S = tr.challengeFrom([rg1,rg2,w,wp],curve.scalar());
            let f = challenge.mul(secret).add(t.neg());
            return { 
                f: f,
                e: challenge,
            };

}

export function verify<S extends Scalar,
    P extends Point<S>,
    C extends Curve<S,P>,
    T extends Transcript<S>>( curve: C, tr: T,
    base1: P, base2: P, rg1: P, rg2: P, proof: Proof<S>): boolean {
    
        let w = base1.mul(proof.f).add(curve.point().set(rg1).mul(proof.e)); 
        let wp = base2.mul(proof.f).add(curve.point().set(rg2).mul(proof.e)); 
        let challenge :S  = tr.challengeFrom([rg1,rg2,w,wp],curve.scalar());
        if (challenge.equal(proof.e)) {
            return true;
        }
        return false;
}