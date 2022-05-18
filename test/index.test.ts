//import test from "ava";
import assert from "assert";

import { foo } from "../src/index";
import { onlyZero } from "../src/utils";

describe("foo testing", () => {
  it("foo()", () => {
    assert.equal(foo(1, 2), 3);
  });

  it("only zero", () => {
    const b = new Uint8Array([0, 0, 0]);
    assert.ok(onlyZero(b));
    const a = new Uint8Array([0, 0, 0, 1]);
    assert.ok(!onlyZero(a));
  });
});
