import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  isMatchAtCapacity,
  matchHeadcount,
  parseMaxPlayersField,
  slotsRemaining,
} from "./matchCapacity";

describe("matchHeadcount", () => {
  it("counts members and guests", () => {
    assert.equal(
      matchHeadcount([
        { guests: [] },
        { guests: [{}, {}] },
      ]),
      4
    );
  });
});

describe("slotsRemaining", () => {
  it("returns null when unlimited", () => {
    assert.equal(slotsRemaining(null, 5), null);
    assert.equal(slotsRemaining(undefined, 5), null);
  });

  it("never goes negative", () => {
    assert.equal(slotsRemaining(4, 6), 0);
    assert.equal(slotsRemaining(8, 3), 5);
  });
});

describe("isMatchAtCapacity", () => {
  it("is false when unlimited or under limit", () => {
    assert.equal(isMatchAtCapacity(null, 99), false);
    assert.equal(isMatchAtCapacity(8, 7), false);
  });

  it("is true at or over the limit", () => {
    assert.equal(isMatchAtCapacity(8, 8), true);
    assert.equal(isMatchAtCapacity(8, 9), true);
  });
});

describe("parseMaxPlayersField", () => {
  it("treats omit as undefined and null/empty as unlimited", () => {
    assert.deepEqual(parseMaxPlayersField(undefined), { ok: true, value: undefined });
    assert.deepEqual(parseMaxPlayersField(null), { ok: true, value: null });
    assert.deepEqual(parseMaxPlayersField(""), { ok: true, value: null });
  });

  it("accepts positive integers", () => {
    assert.deepEqual(parseMaxPlayersField(12), { ok: true, value: 12 });
    assert.deepEqual(parseMaxPlayersField("8"), { ok: true, value: 8 });
  });

  it("rejects zero, negative, and non-integers", () => {
    assert.equal(parseMaxPlayersField(0).ok, false);
    assert.equal(parseMaxPlayersField(-1).ok, false);
    assert.equal(parseMaxPlayersField(1.5).ok, false);
    assert.equal(parseMaxPlayersField("x").ok, false);
  });
});
