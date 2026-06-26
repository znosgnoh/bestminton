import { Prisma } from "@prisma/client";
import { sideAverageElo, sideWinProbabilities } from "./elo";
import type {
  BetDTO,
  ChallengeDTO,
  ChallengePlayerDTO,
  ChallengeResolutionDTO,
  ChallengeSide,
} from "./types";
import { CHALLENGE_FULL_INCLUDE } from "./challengeIncludes";

export type ChallengeWithRelations = Prisma.ChallengeGetPayload<{
  include: typeof CHALLENGE_FULL_INCLUDE;
}>;

function toPlayer(member: {
  id: number;
  name: string;
  avatarUrl: string | null;
  eloRating: number;
}): ChallengePlayerDTO {
  return {
    id: member.id,
    name: member.name,
    avatarUrl: member.avatarUrl,
    eloRating: member.eloRating,
  };
}

function buildSide(
  players: ChallengePlayerDTO[],
  bets: BetDTO[],
  side: ChallengeSide,
  winProbability: number
): ChallengeDTO["sideA"] {
  const sideBets = bets.filter((b) => b.side === side);
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

export function serializeChallenge(
  challenge: ChallengeWithRelations,
  options?: { includeBets?: boolean }
): ChallengeDTO {
  const includeBets = options?.includeBets !== false;

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
    handicapRecipientSide
  );

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

  const resolution = challenge.resolutionSnapshot as ChallengeResolutionDTO | null;

  return {
    id: challenge.id,
    format: challenge.format as ChallengeDTO["format"],
    status: challenge.status as ChallengeDTO["status"],
    isDrinkChallenge: challenge.isDrinkChallenge,
    handicapPoints: challenge.handicapPoints,
    handicapRecipientSide,
    winnerSide: (challenge.winnerSide as ChallengeSide | null) ?? null,
    winnerId: challenge.winnerId,
    createdAt: challenge.createdAt.toISOString(),
    completedAt: challenge.completedAt?.toISOString() ?? null,
    sideA: buildSide(sideAPlayers, bets, "A", winProbabilities.sideA),
    sideB: buildSide(sideBPlayers, bets, "B", winProbabilities.sideB),
    bets,
    resolution: resolution ?? undefined,
  };
}

export function serializeChallengeList(challenge: ChallengeWithRelations): ChallengeDTO {
  return serializeChallenge(challenge, { includeBets: false });
}
