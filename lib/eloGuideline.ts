import {
  DEFAULT_ELO,
  ELO_PER_HANDICAP_POINT,
  K_FACTOR_ESTABLISHED,
  K_FACTOR_NEW,
  K_MATCH_THRESHOLD,
  computeSinglesEloChanges,
  expectedScore,
  expectedScoreWithHandicap,
  handicapRecipientSide,
  sideWinProbabilities,
} from "./elo";
import type { HandicapRecipientSide } from "./elo";

export const ELO_GUIDELINE_ANCHOR = "elo-guideline";
export const ELO_GUIDELINE_HREF = `/leaderboard#${ELO_GUIDELINE_ANCHOR}`;

export interface EloGuidelineExample {
  id: string;
  labelKey: "exFavoriteClose" | "exFavoriteStomp" | "exUpset" | "exUpsetHandicap";
  matchup: string;
  score: string;
  handicap: number;
  winner: HandicapRecipientSide;
  winnerDelta: number;
  loserDelta: number;
}

function exampleRow(
  id: string,
  labelKey: EloGuidelineExample["labelKey"],
  matchup: string,
  eloA: number,
  eloB: number,
  winner: HandicapRecipientSide,
  score: string,
  handicap: number
): EloGuidelineExample {
  const changes = computeSinglesEloChanges(
    { id: 1, name: "A", eloRating: eloA, totalMatches: 20, side: "A" },
    { id: 2, name: "B", eloRating: eloB, totalMatches: 20, side: "B" },
    winner,
    handicap,
    score
  );
  const w = changes.find((c) => c.delta > 0)!;
  const l = changes.find((c) => c.delta < 0)!;
  return {
    id,
    labelKey,
    matchup,
    score,
    handicap,
    winner,
    winnerDelta: w.delta,
    loserDelta: l.delta,
  };
}

/** Precomputed scenarios for the leaderboard guideline (established K = 16). */
export const ELO_GUIDELINE_EXAMPLES: EloGuidelineExample[] = [
  exampleRow(
    "favorite-close",
    "exFavoriteClose",
    "1200 vs 1000",
    1200,
    1000,
    "A",
    "21-19, 21-19",
    0
  ),
  exampleRow(
    "favorite-stomp",
    "exFavoriteStomp",
    "1200 vs 1000",
    1200,
    1000,
    "A",
    "21-10, 21-8",
    0
  ),
  exampleRow(
    "upset",
    "exUpset",
    "1000 vs 1200",
    1000,
    1200,
    "A",
    "21-19",
    0
  ),
  exampleRow(
    "upset-handicap",
    "exUpsetHandicap",
    "1000 vs 1200",
    1000,
    1200,
    "A",
    "19-21, 21-18, 21-16",
    6
  ),
];

export interface WinProbabilityDemo {
  ratingA: number;
  ratingB: number;
  handicap: number;
  recipient: HandicapRecipientSide;
  sideA: number;
  sideB: number;
}

export const ELO_WIN_PROB_DEMO: WinProbabilityDemo = (() => {
  const ratingA = 1100;
  const ratingB = 1000;
  const handicap = 6;
  const recipient = handicapRecipientSide(ratingA, ratingB);
  const probs = sideWinProbabilities(ratingA, ratingB, handicap, recipient);
  return {
    ratingA,
    ratingB,
    handicap,
    recipient,
    sideA: probs.sideA,
    sideB: probs.sideB,
  };
})();

export const ELO_GUIDELINE_FACTS = {
  defaultElo: DEFAULT_ELO,
  kNew: K_FACTOR_NEW,
  kEstablished: K_FACTOR_ESTABLISHED,
  kThreshold: K_MATCH_THRESHOLD,
  eloPerHandicapPoint: ELO_PER_HANDICAP_POINT,
} as const;

export function formatWinPct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

export function demoExpectedWithoutHandicap(ratingA: number, ratingB: number): number {
  return expectedScore(ratingA, ratingB);
}

export function demoExpectedWithHandicap(
  ratingA: number,
  ratingB: number,
  handicap: number,
  recipient: HandicapRecipientSide
): number {
  return expectedScoreWithHandicap(ratingA, ratingB, handicap, recipient);
}
