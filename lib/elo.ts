export const DEFAULT_ELO = 1000;
export const K_FACTOR_NEW = 32;
export const K_FACTOR_ESTABLISHED = 16;
export const K_MATCH_THRESHOLD = 10;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

/** Elo gap that maps to 6 handicap points under the legacy linear rule (diff / 50). */
const HANDICAP_REFERENCE_DIFF = 300;
const HANDICAP_REFERENCE_POINTS = 6;

/** Elo boost per handicap point — inverse of suggestedHandicap's 300 Elo → 6 pts rule. */
export const ELO_PER_HANDICAP_POINT = HANDICAP_REFERENCE_DIFF / HANDICAP_REFERENCE_POINTS;

export type HandicapRecipientSide = "A" | "B";

/**
 * Win probability for side A when the weaker side receives handicap points.
 * Handicap is modeled as an effective Elo boost on the recipient (50 Elo per point).
 */
export function expectedScoreWithHandicap(
  ratingA: number,
  ratingB: number,
  handicapPoints: number,
  handicapRecipientSide: HandicapRecipientSide
): number {
  if (handicapPoints <= 0) {
    return expectedScore(ratingA, ratingB);
  }
  const boost = handicapPoints * ELO_PER_HANDICAP_POINT;
  if (handicapRecipientSide === "A") {
    return expectedScore(ratingA + boost, ratingB);
  }
  return expectedScore(ratingA, ratingB + boost);
}

export function sideWinProbabilities(
  ratingA: number,
  ratingB: number,
  handicapPoints: number,
  handicapRecipientSide: HandicapRecipientSide
): { sideA: number; sideB: number } {
  const sideA = expectedScoreWithHandicap(
    ratingA,
    ratingB,
    handicapPoints,
    handicapRecipientSide
  );
  return { sideA, sideB: 1 - sideA };
}

/**
 * Sub-linear scaling exponent. Doubling the Elo gap yields 1.5× handicap (not 2×).
 * Calibrated so 300 Elo → 6 pts and 600 Elo → 9 pts (adjacent-pair chain example).
 */
const HANDICAP_SUBLINEAR_EXPONENT = Math.log(1.5) / Math.log(2);

export function suggestedHandicap(ratingA: number, ratingB: number): number {
  const diff = Math.abs(ratingA - ratingB);
  if (diff === 0) return 0;
  return Math.round(
    HANDICAP_REFERENCE_POINTS *
      Math.pow(diff / HANDICAP_REFERENCE_DIFF, HANDICAP_SUBLINEAR_EXPONENT)
  );
}

export function kFactor(totalMatches: number): number {
  return totalMatches < K_MATCH_THRESHOLD ? K_FACTOR_NEW : K_FACTOR_ESTABLISHED;
}

export function newRating(
  oldRating: number,
  actual: 0 | 1,
  expected: number,
  totalMatches: number,
  multiplier = 1
): number {
  const k = kFactor(totalMatches);
  return Math.round(oldRating + k * multiplier * (actual - expected));
}

/** Weaker side (lower average Elo) receives the handicap. */
export function handicapRecipientSide(ratingA: number, ratingB: number): HandicapRecipientSide {
  return ratingA <= ratingB ? "A" : "B";
}

export interface ParsedMatchScore {
  /** Games/sets won by the match winner */
  winnerGames: number;
  /** Games/sets won by the match loser */
  loserGames: number;
  /** Sum of per-game point margins (|high − low|) */
  totalPointMargin: number;
  /** Count of parsed games with point scores */
  pointGames: number;
}

const SCORE_PAIR_RE = /^(\d+)\s*[-–]\s*(\d+)$/;

/**
 * Parse captain-entered scores such as "21-15, 21-18" or "2-1".
 * Per-game scores assume the higher score won that game.
 */
export function parseConfirmedScore(score: string): ParsedMatchScore | null {
  const trimmed = score.trim();
  if (!trimmed) return null;

  const segments = trimmed
    .split(/[,;]/)
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length === 1) {
    const setOnly = segments[0].match(SCORE_PAIR_RE);
    if (setOnly) {
      const first = parseInt(setOnly[1], 10);
      const second = parseInt(setOnly[2], 10);
      if (
        Number.isFinite(first) &&
        Number.isFinite(second) &&
        first !== second &&
        first <= 3 &&
        second <= 3 &&
        first + second <= 5
      ) {
        const winnerGames = Math.max(first, second);
        const loserGames = Math.min(first, second);
        return { winnerGames, loserGames, totalPointMargin: 0, pointGames: 0 };
      }
    }
  }

  let winnerGames = 0;
  let loserGames = 0;
  let totalPointMargin = 0;
  let pointGames = 0;

  for (const segment of segments) {
    const match = segment.match(SCORE_PAIR_RE);
    if (!match) continue;
    const first = parseInt(match[1], 10);
    const second = parseInt(match[2], 10);
    if (!Number.isFinite(first) || !Number.isFinite(second) || first === second) continue;

    pointGames++;
    totalPointMargin += Math.abs(first - second);
    if (first > second) winnerGames++;
    else loserGames++;
  }

  if (pointGames === 0) return null;
  return { winnerGames, loserGames, totalPointMargin, pointGames };
}

/**
 * Scale K by how decisive the result was.
 * Straight-set / large point margins → larger changes; close 2-1 → smaller.
 */
export function scoreMarginMultiplier(parsed: ParsedMatchScore | null): number {
  if (!parsed) return 1;

  const gamesTotal = parsed.winnerGames + parsed.loserGames;
  let multiplier = 1;

  if (gamesTotal > 0) {
    const gameSpread = parsed.winnerGames - parsed.loserGames;
    multiplier *= 1 + gameSpread / (gamesTotal * 4);
  }

  if (parsed.pointGames > 0) {
    const avgMargin = parsed.totalPointMargin / parsed.pointGames;
    multiplier *= 0.9 + Math.min(0.35, avgMargin / 24);
  }

  return Math.min(1.5, Math.max(0.75, multiplier));
}

/**
 * Extra K scaling from rating gap × result surprise.
 * Upsets with a large Elo gap move more; expected blowouts move less.
 */
export function eloGapKMultiplier(
  playerRating: number,
  opponentRating: number,
  actual: 0 | 1,
  expected: number
): number {
  const diff = Math.abs(playerRating - opponentRating);
  const surprise = Math.abs(actual - expected);
  if (surprise < 0.01 || diff < 1) return 1;
  return 1 + surprise * Math.min(0.5, diff / 400);
}

export interface SinglesEloCompetitor {
  id: number;
  name: string;
  eloRating: number;
  totalMatches: number;
  side: HandicapRecipientSide;
}

export interface SinglesEloChange {
  memberId: number;
  name: string;
  before: number;
  after: number;
  delta: number;
}

/**
 * Singles Elo update: handicap-adjusted expectation, scaled by score margin and Elo gap.
 */
export function computeSinglesEloChanges(
  playerA: SinglesEloCompetitor,
  playerB: SinglesEloCompetitor,
  winnerSide: HandicapRecipientSide,
  confirmedHandicapPoints: number,
  confirmedScore: string
): SinglesEloChange[] {
  const recipient = handicapRecipientSide(playerA.eloRating, playerB.eloRating);
  const expectedA = expectedScoreWithHandicap(
    playerA.eloRating,
    playerB.eloRating,
    confirmedHandicapPoints,
    recipient
  );
  const scoreMult = scoreMarginMultiplier(parseConfirmedScore(confirmedScore));

  return [playerA, playerB].map((player) => {
    const opponent = player === playerA ? playerB : playerA;
    const expected = player.side === "A" ? expectedA : 1 - expectedA;
    const actual: 0 | 1 = player.side === winnerSide ? 1 : 0;
    const gapMult = eloGapKMultiplier(player.eloRating, opponent.eloRating, actual, expected);
    const after = newRating(
      player.eloRating,
      actual,
      expected,
      player.totalMatches,
      scoreMult * gapMult
    );
    return {
      memberId: player.id,
      name: player.name,
      before: player.eloRating,
      after,
      delta: after - player.eloRating,
    };
  });
}

/** Average Elo for a side (1 or 2 players). */
export function sideAverageElo(ratings: number[]): number {
  if (ratings.length === 0) return DEFAULT_ELO;
  return ratings.reduce((s, r) => s + r, 0) / ratings.length;
}
