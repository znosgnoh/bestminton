import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  STALE_PENDING_CHALLENGE_MS,
  isStalePendingChallenge,
  stalePendingCutoff,
} from "./staleChallenges";

describe("stalePendingCutoff", () => {
  it("is 3 days before now", () => {
    const now = new Date("2026-08-20T12:00:00.000Z");
    assert.equal(
      stalePendingCutoff(now).toISOString(),
      new Date(now.getTime() - STALE_PENDING_CHALLENGE_MS).toISOString()
    );
  });
});

describe("isStalePendingChallenge", () => {
  const now = new Date("2026-08-20T12:00:00.000Z");

  it("deletes PENDING kèo at or past 3 days", () => {
    const createdAt = new Date(now.getTime() - STALE_PENDING_CHALLENGE_MS);
    assert.equal(isStalePendingChallenge("PENDING", createdAt, now), true);
  });

  it("keeps PENDING kèo younger than 3 days", () => {
    const createdAt = new Date(now.getTime() - STALE_PENDING_CHALLENGE_MS + 1);
    assert.equal(isStalePendingChallenge("PENDING", createdAt, now), false);
  });

  it("keeps started and completed kèo even when old", () => {
    const createdAt = new Date(now.getTime() - STALE_PENDING_CHALLENGE_MS * 4);
    assert.equal(isStalePendingChallenge("ACTIVE", createdAt, now), false);
    assert.equal(isStalePendingChallenge("COMPLETED", createdAt, now), false);
  });
});
