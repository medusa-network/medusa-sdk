import assert from "assert";
import { init, suite, newKeypair } from "../src/index";
import { onlyZero } from "../src/utils";

describe("index module", () => {
  it("new keypair", async () => {
    await init();
    const kp = newKeypair(suite);
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
