import { Prisma } from "@prisma/client";
import { sideAverageElo, sideWinProbabilities } from "./elo";
import type {
  BetDTO,
  ChallengeDTO,
  ChallengePlayerDTO,
  ChallengeResolutionDTO,
  ChallengeSide,
} from "./types";
import { CHALLENGE_FULL_INCLUDE, CHALLENGE_LIST_INCLUDE } from "./challengeIncludes";

export type ChallengeWithRelations = Prisma.ChallengeGetPayload<{
  include: typeof CHALLENGE_FULL_INCLUDE;
}>;

export type ChallengeListWithRelations = Prisma.ChallengeGetPayload<{
  include: typeof CHALLENGE_LIST_INCLUDE;
}>;

function toPlayer(member: {
  id: number;
  name: string;
  avatarUrl: string | null;
  eloRating: number;
  totalMatches: number;
  totalWins: number;
}): ChallengePlayerDTO {
  return {
    id: member.id,
    name: member.name,
    avatarUrl: member.avatarUrl,
    eloRating: member.eloRating,
    totalMatches: member.totalMatches,
    totalWins: member.totalWins,
    winRate: member.totalMatches > 0 ? member.totalWins / member.totalMatches : 0,
  };
}

function buildSide(
  players: ChallengePlayerDTO[],
  poolBets: Array<{ side: ChallengeSide; amount: number }>,
  side: ChallengeSide,
  winProbability: number
): ChallengeDTO["sideA"] {
  const sideBets = poolBets.filter((b) => b.side === side);
  const ratings = players.map((p) => p.eloRating);
  const averageElo = sideAverageElo(ratings);
  return {
    players,
    averageElo,
    winProbability,
    poolTokens: sideBets.reduce((s, b) => s + b.amount, 0),
    poolBets: sideBets.length,
  };
}

function buildPlayersAndProbs(challenge: {
  playerA: Parameters<typeof toPlayer>[0];
  playerA2: Parameters<typeof toPlayer>[0] | null;
  playerB: Parameters<typeof toPlayer>[0];
  playerB2: Parameters<typeof toPlayer>[0] | null;
  handicapPoints: number;
  pointsToWin: number;
}) {
  const sideAPlayers: ChallengePlayerDTO[] = [toPlayer(challenge.playerA)];
  if (challenge.playerA2) sideAPlayers.push(toPlayer(challenge.playerA2));

  const sideBPlayers: ChallengePlayerDTO[] = [toPlayer(challenge.playerB)];
  if (challenge.playerB2) sideBPlayers.push(toPlayer(challenge.playerB2));

  const sideAAvg = sideAverageElo(sideAPlayers.map((p) => p.eloRating));
  const sideBAvg = sideAverageElo(sideBPlayers.map((p) => p.eloRating));
  const handicapRecipientSide: ChallengeSide = sideAAvg <= sideBAvg ? "A" : "B";
  const winProbabilities = sideWinProbabilities(
    sideAAvg,
    sideBAvg,
    challenge.handicapPoints,
    handicapRecipientSide,
    challenge.pointsToWin
  );

  return { sideAPlayers, sideBPlayers, handicapRecipientSide, winProbabilities };
}

export function serializeChallenge(
  challenge: ChallengeWithRelations,
  options?: { includeBets?: boolean }
): ChallengeDTO {
  const includeBets = options?.includeBets !== false;
  const { sideAPlayers, sideBPlayers, handicapRecipientSide, winProbabilities } =
    buildPlayersAndProbs(challenge);

  const bets: BetDTO[] = includeBets
    ? challenge.bets.map((b) => ({
        id: b.id,
        challengeId: b.challengeId,
        bettorId: b.bettorId,
        counterpartyId: b.counterpartyId,
        side: b.side as ChallengeSide,
        amount: b.amount,
        bettor: {
          id: b.bettor.id,
          name: b.bettor.name,
          avatarUrl: b.bettor.avatarUrl,
        },
        counterparty: b.counterparty
          ? {
              id: b.counterparty.id,
              name: b.counterparty.name,
              avatarUrl: b.counterparty.avatarUrl,
            }
          : null,
      }))
    : [];

  const poolBets = includeBets
    ? bets
    : challenge.bets.map((b) => ({
        side: b.side as ChallengeSide,
        amount: b.amount,
      }));

  const resolution = challenge.resolutionSnapshot as ChallengeResolutionDTO | null;

  return {
    id: challenge.id,
    format: challenge.format as ChallengeDTO["format"],
    status: challenge.status as ChallengeDTO["status"],
    isDrinkChallenge: challenge.isDrinkChallenge,
    pointsToWin: challenge.pointsToWin,
    handicapPoints: challenge.handicapPoints,
    confirmedHandicapPoints: challenge.confirmedHandicapPoints ?? null,
    confirmedScore: challenge.confirmedScore ?? null,
    notes: challenge.notes ?? null,
    handicapRecipientSide,
    winnerSide: (challenge.winnerSide as ChallengeSide | null) ?? null,
    winnerId: challenge.winnerId,
    createdAt: challenge.createdAt.toISOString(),
    completedAt: challenge.completedAt?.toISOString() ?? null,
    youtubeUrl: challenge.youtubeUrl ?? null,
    sideA: buildSide(sideAPlayers, poolBets, "A", winProbabilities.sideA),
    sideB: buildSide(sideBPlayers, poolBets, "B", winProbabilities.sideB),
    bets,
    resolution: resolution ?? undefined,
  };
}

/** Slim serializer for list/history — pool counts without full bet payloads. */
export function serializeChallengeList(challenge: ChallengeListWithRelations): ChallengeDTO {
  const { sideAPlayers, sideBPlayers, handicapRecipientSide, winProbabilities } =
    buildPlayersAndProbs(challenge);

  const poolBets = challenge.bets.map((b) => ({
    side: b.side as ChallengeSide,
    amount: b.amount,
  }));

  const resolution = challenge.resolutionSnapshot as ChallengeResolutionDTO | null;

  return {
    id: challenge.id,
    format: challenge.format as ChallengeDTO["format"],
    status: challenge.status as ChallengeDTO["status"],
    isDrinkChallenge: challenge.isDrinkChallenge,
    pointsToWin: challenge.pointsToWin,
    handicapPoints: challenge.handicapPoints,
    confirmedHandicapPoints: challenge.confirmedHandicapPoints ?? null,
    confirmedScore: challenge.confirmedScore ?? null,
    notes: challenge.notes ?? null,
    handicapRecipientSide,
    winnerSide: (challenge.winnerSide as ChallengeSide | null) ?? null,
    winnerId: challenge.winnerId,
    createdAt: challenge.createdAt.toISOString(),
    completedAt: challenge.completedAt?.toISOString() ?? null,
    youtubeUrl: challenge.youtubeUrl ?? null,
    sideA: buildSide(sideAPlayers, poolBets, "A", winProbabilities.sideA),
    sideB: buildSide(sideBPlayers, poolBets, "B", winProbabilities.sideB),
    bets: [],
    resolution: resolution ?? undefined,
  };
}
