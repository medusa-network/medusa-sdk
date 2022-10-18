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

  it("should verify", () => {
    let base1 = curve.point().random();
    let base2 = curve.point().random();
    let secret = curve.scalar().random();
    let rg1 = curve.point().set(base1).mul(secret);
    let rg2 = curve.point().set(base2).mul(secret);
    let prover_transcript = new ShaTranscript();
    let proof = prove(curve,prover_transcript,
            // need to clone but Atom can't clone() ??! 
            curve.point().set(base1),
            curve.point().set(base2)
            ,secret);
    let verifier_transcript = new ShaTranscript();
    let valid = verify(curve,verifier_transcript,
            curve.point().set(base1),
            curve.point().set(base2),
            rg1,rg2, proof);
    assert.ok(valid);


  });

});