import assert from "assert";

import { onlyZero } from "../src/utils";

describe("utils module", () => {
  it("only zero", () => {
    const b = new Uint8Array([0, 0, 0]);
    assert.ok(onlyZero(b));
    const a = new Uint8Array([0, 0, 0, 1]);
    assert.ok(!onlyZero(a));
  });
});
