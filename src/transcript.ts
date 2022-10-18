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
        let i = 0;
        while (true) {
            let hasher = new sha256.Hash();
            for (let e of elements) {
                hasher.update(e.serialize()); 
            }
            if (i != 0) {
                hasher.update(new Uint8Array([i]));
            }
            const result = hasher.digest();
            let r = into.deserialize(result);
            if (r.isOk()) {
                return r.value;
            }
            i += 1;
        }
    }
}