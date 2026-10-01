import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { STREAK_LONG_THRESHOLD, streakKind } from "./streakUi";

describe("streakKind", () => {
  it("returns null below active threshold", () => {
    assert.equal(streakKind(0, 0), null);
    assert.equal(streakKind(2, 2), null);
  });

  it("returns fire for streaks 3–5", () => {
    assert.equal(streakKind(3, 0), "fire");
    assert.equal(streakKind(5, 0), "fire");
  });

  it("returns inferno for streaks more than 5", () => {
    assert.equal(STREAK_LONG_THRESHOLD, 6);
    assert.equal(streakKind(6, 0), "inferno");
    assert.equal(streakKind(12, 0), "inferno");
  });

  it("prefers win fire over ice", () => {
    assert.equal(streakKind(4, 4), "fire");
  });
});
