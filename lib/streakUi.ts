import { STREAK_ACTIVE_THRESHOLD } from "@/lib/elo";

/** Win/lose streak length that unlocks the amplified “inferno” UI (more than 5). */
export const STREAK_LONG_THRESHOLD = 6;

export type StreakKind = "fire" | "inferno" | "ice" | null;

export function streakKind(winStreak: number, loseStreak: number): StreakKind {
  if (winStreak >= STREAK_LONG_THRESHOLD) return "inferno";
  if (winStreak >= STREAK_ACTIVE_THRESHOLD) return "fire";
  if (loseStreak >= STREAK_ACTIVE_THRESHOLD) return "ice";
  return null;
}

export function streakCount(winStreak: number, loseStreak: number): number {
  const kind = streakKind(winStreak, loseStreak);
  if (kind === "inferno" || kind === "fire") return winStreak;
  if (kind === "ice") return loseStreak;
  return 0;
}
