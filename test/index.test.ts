import assert from "assert";
import { Bn254Suite } from "../src/bn254";
import { Medusa, SuiteType } from "../src/index";
import { onlyZero } from "../src/utils";

describe("index module", () => {
  it("new keypair", async () => {
    await Medusa.init(SuiteType.BN254_KEYG1_HGAMAL);
    const suite = new Bn254Suite();
    const kp = Medusa.newKeypair(suite);
    assert.ok(!kp.pubkey.equal(suite.point().zero()));
    assert.ok(!kp.secret.equal(suite.scalar().zero()));
  });
});

describe("utils module", () => {
  it("only zero", () => {
    const b = new Uint8Array([0, 0, 0]);
    assert.ok(onlyZero(b));
    const a = new Uint8Array([0, 0, 0, 1]);
    assert.ok(!onlyZero(a));
  });
});
