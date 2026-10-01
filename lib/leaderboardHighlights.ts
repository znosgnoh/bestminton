import { STREAK_ACTIVE_THRESHOLD } from "@/lib/elo";
import { STREAK_LONG_THRESHOLD } from "@/lib/streakUi";
import type { LeaderboardEntryDTO } from "@/lib/types";

export type SpotlightKind = "inferno" | "onFire" | "mostActive" | "camKing" | "sharpest";

export interface PlayerSpotlight {
  kind: SpotlightKind;
  entry: LeaderboardEntryDTO;
  /** Value shown next to the label (streak count, matches, cam net, win %). */
  value: number;
}

const MIN_MATCHES_FOR_SHARP = 5;

/**
 * Pick up to one spotlight per kind from players outside the podium (rank > 3).
 * Each player appears at most once (priority: inferno → onFire → mostActive → camKing → sharpest).
 */
export function pickPlayerSpotlights(
  entries: LeaderboardEntryDTO[],
  options: { podiumSize?: number } = {}
): PlayerSpotlight[] {
  const podiumSize = options.podiumSize ?? 3;
  const pool = entries.filter((e) => e.rank > podiumSize);
  if (pool.length === 0) return [];

  const used = new Set<number>();
  const out: PlayerSpotlight[] = [];

  const take = (
    kind: SpotlightKind,
    candidates: LeaderboardEntryDTO[],
    valueOf: (e: LeaderboardEntryDTO) => number,
    eligible: (e: LeaderboardEntryDTO) => boolean
  ) => {
    const pick = candidates
      .filter((e) => !used.has(e.id) && eligible(e))
      .sort((a, b) => {
        const dv = valueOf(b) - valueOf(a);
        if (dv !== 0) return dv;
        return a.rank - b.rank;
      })[0];
    if (!pick) return;
    used.add(pick.id);
    out.push({ kind, entry: pick, value: valueOf(pick) });
  };

  take(
    "inferno",
    pool,
    (e) => e.singlesWinStreak,
    (e) => e.singlesWinStreak >= STREAK_LONG_THRESHOLD
  );
  take(
    "onFire",
    pool,
    (e) => e.singlesWinStreak,
    (e) =>
      e.singlesWinStreak >= STREAK_ACTIVE_THRESHOLD &&
      e.singlesWinStreak < STREAK_LONG_THRESHOLD
  );
  take(
    "mostActive",
    pool,
    (e) => e.totalMatches,
    (e) => e.totalMatches > 0
  );
  take(
    "camKing",
    pool,
    (e) => e.debtSummary.netCam,
    (e) => e.debtSummary.netCam > 0
  );
  take(
    "sharpest",
    pool,
    (e) => e.winRate,
    (e) => e.totalMatches >= MIN_MATCHES_FOR_SHARP && e.winRate > 0
  );

  return out;
}

export function podiumEntries(entries: LeaderboardEntryDTO[], size = 3): LeaderboardEntryDTO[] {
  return entries.filter((e) => e.rank >= 1 && e.rank <= size).slice(0, size);
}
