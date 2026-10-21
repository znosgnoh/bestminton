import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isRegistrationEditLocked } from "./apiHelpers";

describe("isRegistrationEditLocked", () => {
  const now = Date.parse("2026-10-21T12:00:00.000Z");

  it("is open when upcoming and no deadline", () => {
    assert.equal(
      isRegistrationEditLocked(
        { scheduledAt: "2026-10-22T12:00:00.000Z", registrationClosesAt: null },
        now
      ),
      false
    );
  });

  it("is open when upcoming and deadline is in the future", () => {
    assert.equal(
      isRegistrationEditLocked(
        {
          scheduledAt: "2026-10-22T12:00:00.000Z",
          registrationClosesAt: "2026-10-21T18:00:00.000Z",
        },
        now
      ),
      false
    );
  });

  it("locks when deadline has passed", () => {
    assert.equal(
      isRegistrationEditLocked(
        {
          scheduledAt: "2026-10-22T12:00:00.000Z",
          registrationClosesAt: "2026-10-21T11:00:00.000Z",
        },
        now
      ),
      true
    );
  });

  it("locks past matches even without a deadline", () => {
    assert.equal(
      isRegistrationEditLocked(
        { scheduledAt: "2026-10-20T12:00:00.000Z", registrationClosesAt: null },
        now
      ),
      true
    );
  });
});
