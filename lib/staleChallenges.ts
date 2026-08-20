/** Pending kèo with no start/resolve are removed after this age. */
export const STALE_PENDING_CHALLENGE_MS = 3 * 24 * 60 * 60 * 1000;

export function stalePendingCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - STALE_PENDING_CHALLENGE_MS);
}

export function isStalePendingChallenge(
  status: string,
  createdAt: Date,
  now: Date = new Date()
): boolean {
  return status === "PENDING" && createdAt.getTime() <= stalePendingCutoff(now).getTime();
}
