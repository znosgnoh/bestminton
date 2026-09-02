import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { reminderKindsDue, shareIdsFingerprint } from "./reminders";

const H = 60 * 60 * 1000;

describe("reminderKindsDue", () => {
  const scheduledAt = new Date("2026-09-10T18:00:00.000Z");

  it("returns 96h inside ±12h window", () => {
    const now = new Date(scheduledAt.getTime() - 96 * H);
    assert.deepEqual(reminderKindsDue(now, scheduledAt), ["96h"]);
  });

  it("returns 48h inside ±12h window", () => {
    const now = new Date(scheduledAt.getTime() - 48 * H);
    assert.deepEqual(reminderKindsDue(now, scheduledAt), ["48h"]);
  });

  it("returns empty outside windows", () => {
    const now = new Date(scheduledAt.getTime() - 72 * H);
    assert.deepEqual(reminderKindsDue(now, scheduledAt), []);
  });

  it("returns empty for past matches", () => {
    const now = new Date(scheduledAt.getTime() + H);
    assert.deepEqual(reminderKindsDue(now, scheduledAt), []);
  });
});

describe("shareIdsFingerprint", () => {
  it("sorts ids for stable key", () => {
    assert.equal(shareIdsFingerprint([3, 1, 2]), "1,2,3");
  });
});
