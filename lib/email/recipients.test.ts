import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterEligibleRecipients } from "./recipients";

describe("filterEligibleRecipients", () => {
  it("keeps only members with email and notifications enabled", () => {
    const rows = [
      { id: 1, name: "A", email: "a@x.com", emailNotificationsEnabled: true },
      { id: 2, name: "B", email: null, emailNotificationsEnabled: true },
      { id: 3, name: "C", email: "c@x.com", emailNotificationsEnabled: false },
    ];
    assert.deepEqual(filterEligibleRecipients(rows), [
      { memberId: 1, email: "a@x.com", name: "A" },
    ]);
  });
});
