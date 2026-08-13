import {
  DEFAULT_POINTS_TO_WIN,
  isPointsToWin,
  suggestedHandicap,
  type PointsToWin,
} from "@/lib/elo";

export const BULK_MIN_MEMBERS = 2;
export const BULK_MAX_MEMBERS = 16;
export const BULK_MIN_PER_PAIR = 1;
export const BULK_MAX_PER_PAIR = 5;

export interface BulkMember {
  id: number;
  eloRating: number;
}

export interface BulkSinglesRow {
  format: "SINGLES";
  status: "PENDING";
  playerAId: number;
  playerBId: number;
  handicapPoints: number;
  pointsToWin: PointsToWin;
  isDrinkChallenge: boolean;
}

export interface ParsedBulkChallengeInput {
  memberIds: number[];
  perPair: number;
  isDrinkChallenge: boolean;
  pointsToWin: PointsToWin;
}

export function uniqueMemberPairs(memberIds: number[]): [number, number][] {
  const sorted = [...new Set(memberIds)].sort((a, b) => a - b);
  const pairs: [number, number][] = [];
  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      pairs.push([sorted[i], sorted[j]]);
    }
  }
  return pairs;
}

export function pairCount(memberCount: number): number {
  if (memberCount < BULK_MIN_MEMBERS) return 0;
  return (memberCount * (memberCount - 1)) / 2;
}

export function bulkChallengeCount(memberCount: number, perPair: number): number {
  return pairCount(memberCount) * perPair;
}

function orderPair(a: BulkMember, b: BulkMember): [BulkMember, BulkMember] {
  if (a.eloRating !== b.eloRating) {
    return a.eloRating >= b.eloRating ? [a, b] : [b, a];
  }
  return a.id <= b.id ? [a, b] : [b, a];
}

export function buildBulkSinglesRows(
  members: BulkMember[],
  perPair: number,
  options?: { pointsToWin?: PointsToWin; isDrinkChallenge?: boolean }
): BulkSinglesRow[] {
  const pointsToWin = options?.pointsToWin ?? DEFAULT_POINTS_TO_WIN;
  const isDrinkChallenge = options?.isDrinkChallenge !== false;
  const byId = new Map(members.map((m) => [m.id, m]));
  const pairs = uniqueMemberPairs(members.map((m) => m.id));
  const rows: BulkSinglesRow[] = [];

  for (const [idA, idB] of pairs) {
    const memberA = byId.get(idA);
    const memberB = byId.get(idB);
    if (!memberA || !memberB) continue;
    const [sideA, sideB] = orderPair(memberA, memberB);
    const handicapPoints = suggestedHandicap(sideA.eloRating, sideB.eloRating, pointsToWin);
    for (let i = 0; i < perPair; i++) {
      rows.push({
        format: "SINGLES",
        status: "PENDING",
        playerAId: sideA.id,
        playerBId: sideB.id,
        handicapPoints,
        pointsToWin,
        isDrinkChallenge,
      });
    }
  }

  return rows;
}

export function parseBulkChallengeInput(
  body: unknown
): { ok: true; value: ParsedBulkChallengeInput } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body." };
  }

  const rec = body as Record<string, unknown>;
  if (!Array.isArray(rec.memberIds)) {
    return { ok: false, error: "memberIds must be an array." };
  }

  const memberIds: number[] = [];
  const seen = new Set<number>();
  for (const raw of rec.memberIds) {
    const id = Number(raw);
    if (!Number.isInteger(id) || id <= 0) {
      return { ok: false, error: "Invalid member IDs." };
    }
    if (!seen.has(id)) {
      seen.add(id);
      memberIds.push(id);
    }
  }

  if (memberIds.length < BULK_MIN_MEMBERS) {
    return { ok: false, error: `Select at least ${BULK_MIN_MEMBERS} members.` };
  }
  if (memberIds.length > BULK_MAX_MEMBERS) {
    return { ok: false, error: `Too many members (max ${BULK_MAX_MEMBERS}).` };
  }

  let perPair = BULK_MIN_PER_PAIR;
  if (rec.perPair !== undefined) {
    const parsed = Number(rec.perPair);
    if (
      !Number.isInteger(parsed) ||
      parsed < BULK_MIN_PER_PAIR ||
      parsed > BULK_MAX_PER_PAIR
    ) {
      return {
        ok: false,
        error: `perPair must be an integer from ${BULK_MIN_PER_PAIR} to ${BULK_MAX_PER_PAIR}.`,
      };
    }
    perPair = parsed;
  }

  let pointsToWin: PointsToWin = DEFAULT_POINTS_TO_WIN;
  if (rec.pointsToWin !== undefined) {
    const parsed = Number(rec.pointsToWin);
    if (!isPointsToWin(parsed)) {
      return { ok: false, error: "pointsToWin must be 15 or 21." };
    }
    pointsToWin = parsed;
  }

  return {
    ok: true,
    value: {
      memberIds,
      perPair,
      isDrinkChallenge: rec.isDrinkChallenge !== false,
      pointsToWin,
    },
  };
}
