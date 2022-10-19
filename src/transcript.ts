import * as sha256 from "fast-sha256";
import { ok } from "neverthrow";
import { AstPath } from "prettier";
import { Scalar } from "./algebra";
import { EncodingRes } from "./encoding";

export interface ToBytes {
    serialize(): Uint8Array;
}

export interface Transcript {
    challengeFrom<S extends Scalar, T extends ToBytes>
        (elements: T[], into: S): S;
    append<T extends ToBytes>(e: T | Uint8Array): this;
    challenge<S extends Scalar>(into: S): S;
};

export class ShaTranscript implements Transcript {

    state: sha256.Hash;
    constructor() {
        this.state = new sha256.Hash();
    }
    /// Warning: Do not mix append + challenge  and challengeFrom -> the latter uses
    /// a new transcript.
    /// TODO potentially remove this.
    challengeFrom<S extends Scalar, T extends ToBytes>(elements: T[], into: S): S {
        return ShaTranscript.challengeFrom(elements, into);
    }
    append<T extends ToBytes>(e: T | Uint8Array): this {
        if (e instanceof Uint8Array) {
            this.state = this.state.update(e);
        } else {
            this.state = this.state.update(e.serialize());
        }
        return this;
    }
    challenge<S extends Scalar>(into: S): S {
        const result = this.state.digest();
        return into.fromBytes(result);
    }


    /// challenge from an array directly
    static challengeFrom<S extends Scalar, T extends ToBytes>(
        elements: T[], into: S): S {
        let hasher = new ShaTranscript();
        for (let e of elements) {
            console.log("elemnt: ", e, " but all ", elements);
            hasher = hasher.append(e);
        }
        return hasher.challenge(into);
    }
}