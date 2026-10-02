import { STREAK_ACTIVE_THRESHOLD } from "@/lib/elo";
import { STREAK_LONG_THRESHOLD } from "@/lib/streakUi";
import type { LeaderboardEntryDTO } from "@/lib/types";

export type SpotlightKind = "inferno" | "onFire" | "mostActive" | "camKing" | "sharpest";

export interface PlayerSpotlight {
  kind: SpotlightKind;
  entry: LeaderboardEntryDTO;
  /** Value shown next to the label (streak count, matches, cam total, win %). */
  value: number;
}

const MIN_MATCHES_FOR_SHARP = 5;

/** Cam lead uses total owned (positive pool balance), not signed net. */
export function camLeadTotal(entry: LeaderboardEntryDTO): number {
  return entry.debtSummary.totalOwing;
}

/**
 * Pick up to one spotlight per kind.
 * Inferno / onFire / mostActive / sharpest: outside the podium (rank > 3).
 * Cam lead: among all members, by highest total cam owned.
 * Each player appears at most once (priority: inferno → onFire → mostActive → camKing → sharpest).
 */
export function pickPlayerSpotlights(
  entries: LeaderboardEntryDTO[],
  options: { podiumSize?: number } = {}
): PlayerSpotlight[] {
  const podiumSize = options.podiumSize ?? 3;
  const outsidePodium = entries.filter((e) => e.rank > podiumSize);
  if (entries.length === 0) return [];

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
    outsidePodium,
    (e) => e.singlesWinStreak,
    (e) => e.singlesWinStreak >= STREAK_LONG_THRESHOLD
  );
  take(
    "onFire",
    outsidePodium,
    (e) => e.singlesWinStreak,
    (e) =>
      e.singlesWinStreak >= STREAK_ACTIVE_THRESHOLD &&
      e.singlesWinStreak < STREAK_LONG_THRESHOLD
  );
  take(
    "mostActive",
    outsidePodium,
    (e) => e.totalMatches,
    (e) => e.totalMatches > 0
  );
  take(
    "camKing",
    entries,
    camLeadTotal,
    (e) => camLeadTotal(e) > 0
  );
  take(
    "sharpest",
    outsidePodium,
    (e) => e.winRate,
    (e) => e.totalMatches >= MIN_MATCHES_FOR_SHARP && e.winRate > 0
  );

  return out;
}

export function podiumEntries(entries: LeaderboardEntryDTO[], size = 3): LeaderboardEntryDTO[] {
  return entries.filter((e) => e.rank >= 1 && e.rank <= size).slice(0, size);
}
