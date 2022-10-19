import assert from "assert";
import { init, curve } from "../src/bn254";
import { newKeypair } from "../src/index";
import { hexlify, arrayify } from "ethers/lib/utils";
import { ShaTranscript } from "../src/transcript";
import { prove, verify } from "../src/dleq";

describe("dleq proof", () => {
    before(async () => {
        await init();
    });

    it("basic checks", () => {
        let secret = curve.scalar().random();
        let rg1 = curve.point().set(curve.base1()).mul(secret);
        let rg2 = curve.point().set(curve.base2()).mul(secret);
        let prover_transcript = new ShaTranscript();
        let proof = prove(curve, prover_transcript, secret);
        let verifier_transcript = new ShaTranscript();
        let valid = verify(curve, verifier_transcript, rg1, rg2, proof);
        assert.ok(valid);

        proof.f = curve.scalar().random();
        assert.ok(!verify(curve, new ShaTranscript(), rg1, rg2, proof));
    });

});