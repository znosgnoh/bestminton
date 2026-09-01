import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { normalizeMemberEmail } from "./memberEmail";

describe("normalizeMemberEmail", () => {
  it("lowercases and trims valid emails", () => {
    assert.equal(normalizeMemberEmail("  Alice@Example.COM  "), "alice@example.com");
  });

  it("returns null for invalid or empty input", () => {
    assert.equal(normalizeMemberEmail(""), null);
    assert.equal(normalizeMemberEmail("   "), null);
    assert.equal(normalizeMemberEmail("not-an-email"), null);
    assert.equal(normalizeMemberEmail(null), null);
    assert.equal(normalizeMemberEmail(undefined), null);
  });
});
