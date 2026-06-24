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
  totalMatches: number
): number {
  const k = kFactor(totalMatches);
  return Math.round(oldRating + k * (actual - expected));
}

/** Average Elo for a side (1 or 2 players). */
export function sideAverageElo(ratings: number[]): number {
  if (ratings.length === 0) return DEFAULT_ELO;
  return ratings.reduce((s, r) => s + r, 0) / ratings.length;
}
