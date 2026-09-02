import assert from "node:assert/strict";
import { describe, it, beforeEach, afterEach } from "node:test";
import { isEmailConfigured } from "./config";

describe("isEmailConfigured", () => {
  let previous: string | undefined;

  beforeEach(() => {
    previous = process.env.RESEND_API_KEY;
  });

  afterEach(() => {
    if (previous === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = previous;
  });

  it("returns false when RESEND_API_KEY is unset", () => {
    delete process.env.RESEND_API_KEY;
    assert.equal(isEmailConfigured(), false);
  });

  it("returns false when RESEND_API_KEY is blank", () => {
    process.env.RESEND_API_KEY = "   ";
    assert.equal(isEmailConfigured(), false);
  });

  it("returns true when RESEND_API_KEY is set", () => {
    process.env.RESEND_API_KEY = "re_test_key";
    assert.equal(isEmailConfigured(), true);
  });
});
