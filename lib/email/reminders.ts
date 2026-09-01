import type { ReminderKind } from "./types";

export const REMINDER_OFFSET_MS: Record<ReminderKind, number> = {
  "96h": 96 * 60 * 60 * 1000,
  "48h": 48 * 60 * 60 * 1000,
};

export const REMINDER_WINDOW_MS = 30 * 60 * 1000;

export function reminderKindsDue(now: Date, scheduledAt: Date): ReminderKind[] {
  if (scheduledAt.getTime() <= now.getTime()) return [];
  const delta = scheduledAt.getTime() - now.getTime();
  const kinds: ReminderKind[] = [];
  for (const kind of ["96h", "48h"] as const) {
    const target = REMINDER_OFFSET_MS[kind];
    if (Math.abs(delta - target) <= REMINDER_WINDOW_MS) kinds.push(kind);
  }
  return kinds;
}

export function shareIdsFingerprint(ids: number[]): string {
  return [...ids].sort((a, b) => a - b).join(",");
}
