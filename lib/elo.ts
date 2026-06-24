export const DEFAULT_ELO = 1000;
export const K_FACTOR_NEW = 32;
export const K_FACTOR_ESTABLISHED = 16;
export const K_MATCH_THRESHOLD = 10;

export function expectedScore(ratingA: number, ratingB: number): number {
  return 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
}

export function suggestedHandicap(ratingA: number, ratingB: number): number {
  return Math.round(Math.abs(ratingA - ratingB) / 50);
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
