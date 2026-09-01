import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { planMemberEmailUpdates } from "./syncMemberEmails";

describe("planMemberEmailUpdates", () => {
  it("updates only linked members whose email changed", () => {
    const members = [
      { id: 1, splitwiseId: 100, email: "old@example.com" },
      { id: 2, splitwiseId: 200, email: "same@example.com" },
      { id: 3, splitwiseId: null, email: null },
    ];
    const splitwiseEmails = new Map<number, string>([
      [100, "new@example.com"],
      [200, "same@example.com"],
    ]);

    assert.deepEqual(planMemberEmailUpdates(members, splitwiseEmails), [
      { id: 1, email: "new@example.com" },
    ]);
  });

  it("skips members without splitwiseId or without splitwise email", () => {
    const members = [
      { id: 1, splitwiseId: 100, email: null },
      { id: 2, splitwiseId: 999, email: null },
    ];
    const splitwiseEmails = new Map<number, string>([[100, "a@example.com"]]);

    assert.deepEqual(planMemberEmailUpdates(members, splitwiseEmails), [
      { id: 1, email: "a@example.com" },
    ]);
  });
});
