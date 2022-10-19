import assert from "assert";
import { init, suite } from "../src/bn254";
import { newKeypair } from "../src/index";
import { hexlify, arrayify } from "ethers/lib/utils";
import { ShaTranscript } from "../src/transcript";
import { prove, verify } from "../src/dleq";

describe("dleq proof", () => {
    before(async () => {
        await init();
    });

    it("proof verification", () => {
        let secret = suite.scalar().random();
        let rg1 = suite.base1().mul(secret);
        let rg2 = suite.base2().mul(secret);
        let prover_transcript = new ShaTranscript();
        let proof = prove(suite, prover_transcript, secret,rg1,rg2);
        let verifier_transcript = new ShaTranscript();
        let valid = verify(suite, verifier_transcript, rg1, rg2, proof);
        assert.ok(valid);

        proof.f = suite.scalar().random();
        assert.ok(!verify(suite, new ShaTranscript(), rg1, rg2, proof));
    });

});