import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterEligibleRecipients } from "./recipients";

describe("filterEligibleRecipients", () => {
  it("keeps only active members with email and notifications enabled", () => {
    const rows = [
      { id: 1, name: "A", email: "a@x.com", emailNotificationsEnabled: true, isActive: true },
      { id: 2, name: "B", email: null, emailNotificationsEnabled: true, isActive: true },
      { id: 3, name: "C", email: "c@x.com", emailNotificationsEnabled: false, isActive: true },
      { id: 4, name: "D", email: "d@x.com", emailNotificationsEnabled: true, isActive: false },
    ];
    assert.deepEqual(filterEligibleRecipients(rows), [
      { memberId: 1, email: "a@x.com", name: "A" },
    ]);
  });
});
