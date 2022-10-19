import * as sha256 from "fast-sha256";
import { ok } from "neverthrow";
import { AstPath } from "prettier";
import { Scalar } from "./algebra";
import { EncodingRes } from "./encoding";

export interface ToBytes {
    serialize(): Uint8Array;
}

export interface Transcript<S extends Scalar>{
    challengeFrom<T extends ToBytes>
        (elements : T[], into: S): S;
};

export class ShaTranscript<S extends Scalar> {
    challengeFrom<T extends ToBytes>(
        elements: T[], into: S): S {
        let hasher = new sha256.Hash();
        for (let e of elements) {
            hasher.update(e.serialize()); 
        }
        const result = hasher.digest();
        return into.fromBytes(result);
    }
}