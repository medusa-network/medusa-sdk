import { BigNumber, ethers } from "ethers";
import { arrayify } from "ethers/lib/utils";
import * as sha256 from "fast-sha256";
import { ok } from "neverthrow";
import { AstPath } from "prettier";
import { Scalar } from "./algebra";
import { EncodingRes, ABIEncoder } from "./encoding";

export interface ToBytes {
    serialize(): Uint8Array;
}

export interface EVMTranscript {
    challengeFrom<S extends Scalar, T extends ABIEncoder>
        (elements: T[], into: S): S;
    append<T extends ABIEncoder>(e: T): this;
    challenge<S extends Scalar>(into: S): S;
    digest(): string;
};


export class ShaTranscript implements EVMTranscript {
    elements: Array<any>;
    types: Array<string>;

    constructor() {
        this.elements = [];
        this.types = [];
    }
    /// Warning: Do not mix append + challenge  and challengeFrom -> the latter uses
    /// a new transcript.
    /// TODO potentially remove this.
    challengeFrom<S extends Scalar, T extends ABIEncoder>(elements: T[], into: S): S {
        return ShaTranscript.challengeFrom(elements, into);
    }
    append<T extends ABIEncoder>(e: T): this {
        const [t, v] = e.abiEncode();
        for (var value of v) {
            this.elements.push(value);
        }
        for (var typo of t) {
            this.types.push(typo);
        }
        return this;
    }
    challenge<S extends Scalar>(into: S): S {
        return into.fromBytes(arrayify(this.digest()));
    }
    digest(): string {
        return ethers.utils.soliditySha256(this.types, this.elements);
    }

    /// challenge from an array directly
    static challengeFrom<S extends Scalar, T extends ABIEncoder>(
        elements: T[], into: S): S {
        let hasher = new ShaTranscript();
        for (let e of elements) {
            console.log("elemnt: ", e, " but all ", elements);
            hasher = hasher.append(e);
        }
        return hasher.challenge(into);
    }
}