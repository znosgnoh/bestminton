/** Members + guests currently occupying court slots. */
export function matchHeadcount(
  registrations: Array<{ guests?: ReadonlyArray<unknown> }>
): number {
  return registrations.reduce((sum, r) => sum + 1 + (r.guests?.length ?? 0), 0);
}

/** Remaining slots when a limit is set; `null` means unlimited. */
export function slotsRemaining(
  maxPlayers: number | null | undefined,
  occupied: number
): number | null {
  if (maxPlayers == null) return null;
  return Math.max(0, maxPlayers - occupied);
}

/** True when a limit is set and occupied headcount has reached it. */
export function isMatchAtCapacity(
  maxPlayers: number | null | undefined,
  occupied: number
): boolean {
  return maxPlayers != null && occupied >= maxPlayers;
}

/**
 * Parse optional maxPlayers from create/update bodies.
 * Returns `{ ok: true, value }` where value is `null` (unlimited), a positive int,
 * or `undefined` when the field was omitted (update: leave unchanged).
 */
export function parseMaxPlayersField(
  raw: unknown,
  opts: { requiredPresent?: boolean } = {}
):
  | { ok: true; value: number | null | undefined }
  | { ok: false; error: string } {
  if (raw === undefined) {
    if (opts.requiredPresent) {
      return { ok: false, error: "maxPlayers is required." };
    }
    return { ok: true, value: undefined };
  }
  if (raw === null || raw === "") {
    return { ok: true, value: null };
  }
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isInteger(n) || n < 1) {
    return { ok: false, error: "maxPlayers must be a positive integer." };
  }
  return { ok: true, value: n };
}
