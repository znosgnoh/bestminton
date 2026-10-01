import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { pickPlayerSpotlights, podiumEntries } from "./leaderboardHighlights";
import type { LeaderboardEntryDTO } from "./types";

function entry(
  overrides: Partial<LeaderboardEntryDTO> & Pick<LeaderboardEntryDTO, "id" | "name" | "rank">
): LeaderboardEntryDTO {
  return {
    email: null,
    emailNotificationsEnabled: true,
    avatarUrl: null,
    splitwiseId: null,
    eloRating: 1000,
    totalMatches: 0,
    totalWins: 0,
    singlesWinStreak: 0,
    singlesLoseStreak: 0,
    winRate: 0,
    debtSummary: { totalOwed: 0, totalOwing: 0, netCam: 0 },
    ...overrides,
  };
}

describe("podiumEntries", () => {
  it("returns ranks 1–3 in order", () => {
    const entries = [
      entry({ id: 1, name: "A", rank: 1, eloRating: 1200 }),
      entry({ id: 2, name: "B", rank: 2, eloRating: 1100 }),
      entry({ id: 3, name: "C", rank: 3, eloRating: 1050 }),
      entry({ id: 4, name: "D", rank: 4, eloRating: 1000 }),
    ];
    assert.deepEqual(
      podiumEntries(entries).map((e) => e.id),
      [1, 2, 3]
    );
  });
});

describe("pickPlayerSpotlights", () => {
  it("skips podium players and assigns distinct spotlights", () => {
    const entries = [
      entry({ id: 1, name: "Gold", rank: 1, eloRating: 1300, singlesWinStreak: 8, totalMatches: 40 }),
      entry({ id: 2, name: "Silver", rank: 2, eloRating: 1200 }),
      entry({ id: 3, name: "Bronze", rank: 3, eloRating: 1150 }),
      entry({
        id: 4,
        name: "Hot",
        rank: 4,
        singlesWinStreak: 5,
        totalMatches: 10,
        totalWins: 6,
        winRate: 0.6,
      }),
      entry({
        id: 5,
        name: "Busy",
        rank: 5,
        totalMatches: 30,
        totalWins: 12,
        winRate: 0.4,
      }),
      entry({
        id: 6,
        name: "Cam",
        rank: 6,
        totalMatches: 8,
        totalWins: 3,
        winRate: 0.375,
        debtSummary: { totalOwed: 0, totalOwing: 0, netCam: 7 },
      }),
      entry({
        id: 7,
        name: "Sharp",
        rank: 7,
        totalMatches: 12,
        totalWins: 10,
        winRate: 10 / 12,
      }),
    ];

    const spotlights = pickPlayerSpotlights(entries);
    assert.equal(spotlights.length, 4);
    assert.deepEqual(
      spotlights.map((s) => [s.kind, s.entry.id]),
      [
        ["onFire", 4],
        ["mostActive", 5],
        ["camKing", 6],
        ["sharpest", 7],
      ]
    );
  });

  it("returns empty when only podium exists", () => {
    const entries = [
      entry({ id: 1, name: "A", rank: 1 }),
      entry({ id: 2, name: "B", rank: 2 }),
      entry({ id: 3, name: "C", rank: 3 }),
    ];
    assert.deepEqual(pickPlayerSpotlights(entries), []);
  });
});
