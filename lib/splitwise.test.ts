import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { toJsonSplitwiseId } from "./splitwise";

describe("toJsonSplitwiseId", () => {
  it("keeps IDs larger than INT4", () => {
    assert.equal(toJsonSplitwiseId(BigInt("4640472051")), 4640472051);
    assert.equal(toJsonSplitwiseId(4640472051), 4640472051);
  });

  it("returns null for missing values", () => {
    assert.equal(toJsonSplitwiseId(null), null);
    assert.equal(toJsonSplitwiseId(undefined), null);
  });
});
