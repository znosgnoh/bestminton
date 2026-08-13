import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BULK_MAX_MEMBERS,
  BULK_MAX_PER_PAIR,
  buildBulkSinglesRows,
  bulkChallengeCount,
  parseBulkChallengeInput,
  uniqueMemberPairs,
} from "./bulkChallenges";

describe("uniqueMemberPairs", () => {
  it("returns all unordered pairs", () => {
    assert.deepEqual(uniqueMemberPairs([3, 1, 2]), [
      [1, 2],
      [1, 3],
      [2, 3],
    ]);
  });

  it("dedupes ids", () => {
    assert.deepEqual(uniqueMemberPairs([1, 1, 2]), [[1, 2]]);
  });

  it("returns empty for fewer than two members", () => {
    assert.deepEqual(uniqueMemberPairs([]), []);
    assert.deepEqual(uniqueMemberPairs([7]), []);
  });
});

describe("buildBulkSinglesRows", () => {
  const members = [
    { id: 1, eloRating: 1200 },
    { id: 2, eloRating: 900 },
    { id: 3, eloRating: 1000 },
  ];

  it("creates one drink singles kèo per pair by default", () => {
    const rows = buildBulkSinglesRows(members, 1);
    assert.equal(rows.length, 3);
    assert.ok(rows.every((r) => r.format === "SINGLES"));
    assert.ok(rows.every((r) => r.isDrinkChallenge));
    assert.ok(rows.every((r) => r.pointsToWin === 21));
  });

  it("repeats each pair perPair times", () => {
    const rows = buildBulkSinglesRows(members, 2);
    assert.equal(rows.length, 6);
    assert.equal(bulkChallengeCount(3, 2), 6);
  });

  it("puts the higher Elo on side A and handicaps the weaker side", () => {
    const rows = buildBulkSinglesRows(
      [
        { id: 10, eloRating: 800 },
        { id: 20, eloRating: 1400 },
      ],
      1
    );
    assert.equal(rows.length, 1);
    assert.equal(rows[0].playerAId, 20);
    assert.equal(rows[0].playerBId, 10);
    assert.ok(rows[0].handicapPoints > 0);
  });

  it("can turn drink challenge off", () => {
    const rows = buildBulkSinglesRows(members, 1, { isDrinkChallenge: false });
    assert.ok(rows.every((r) => r.isDrinkChallenge === false));
  });
});

describe("parseBulkChallengeInput", () => {
  it("defaults perPair to 1 and drink on", () => {
    const parsed = parseBulkChallengeInput({ memberIds: [1, 2, 3] });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.deepEqual(parsed.value.memberIds, [1, 2, 3]);
      assert.equal(parsed.value.perPair, 1);
      assert.equal(parsed.value.isDrinkChallenge, true);
      assert.equal(parsed.value.pointsToWin, 21);
    }
  });

  it("dedupes member ids", () => {
    const parsed = parseBulkChallengeInput({ memberIds: [2, 2, 1], perPair: 3 });
    assert.equal(parsed.ok, true);
    if (parsed.ok) {
      assert.deepEqual(parsed.value.memberIds, [2, 1]);
      assert.equal(parsed.value.perPair, 3);
    }
  });

  it("rejects too few or too many members", () => {
    assert.equal(parseBulkChallengeInput({ memberIds: [1] }).ok, false);
    const tooMany = Array.from({ length: BULK_MAX_MEMBERS + 1 }, (_, i) => i + 1);
    assert.equal(parseBulkChallengeInput({ memberIds: tooMany }).ok, false);
  });

  it("rejects invalid perPair", () => {
    assert.equal(parseBulkChallengeInput({ memberIds: [1, 2], perPair: 0 }).ok, false);
    assert.equal(
      parseBulkChallengeInput({ memberIds: [1, 2], perPair: BULK_MAX_PER_PAIR + 1 }).ok,
      false
    );
  });
});
