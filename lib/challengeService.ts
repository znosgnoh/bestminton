import { addDebt } from "./drinkDebt";
import { db } from "./db";
import { expectedScore, newRating, sideAverageElo } from "./elo";
import { CHALLENGE_FULL_INCLUDE } from "./challengeIncludes";
import { serializeChallenge } from "./challengeSerialize";
import type { ChallengeDebtRecord, ChallengeResolutionDTO, ChallengeSide } from "./types";

interface Competitor {
  id: number;
  name: string;
  eloRating: number;
  totalMatches: number;
  totalWins: number;
  side: ChallengeSide;
}

function computeEloChanges(
  competitors: Competitor[],
  winnerSide: ChallengeSide
): ChallengeResolutionDTO["eloChanges"] {
  const sideA = competitors.filter((c) => c.side === "A");
  const sideB = competitors.filter((c) => c.side === "B");
  const sideAAvg = sideAverageElo(sideA.map((c) => c.eloRating));
  const sideBAvg = sideAverageElo(sideB.map((c) => c.eloRating));

  return competitors.map((c) => {
    const opponentAvg = c.side === "A" ? sideBAvg : sideAAvg;
    const expected = expectedScore(c.eloRating, opponentAvg);
    const actual: 0 | 1 = c.side === winnerSide ? 1 : 0;
    const after = newRating(c.eloRating, actual, expected, c.totalMatches);
    return {
      memberId: c.id,
      name: c.name,
      before: c.eloRating,
      after,
      delta: after - c.eloRating,
    };
  });
}

function resolveWinnerId(
  winnerSide: ChallengeSide,
  playerAId: number,
  playerBId: number
): number {
  return winnerSide === "A" ? playerAId : playerBId;
}

/**
 * Record singles match debts: the loser owes the winner 1 ly nước cam.
 */
async function recordSinglesMatchDebts(
  competitors: Competitor[],
  winnerSide: ChallengeSide,
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]
): Promise<ChallengeDebtRecord[]> {
  const winners = competitors.filter((c) => c.side === winnerSide);
  const losers = competitors.filter((c) => c.side !== winnerSide);
  const debts: ChallengeDebtRecord[] = [];

  for (const loser of losers) {
    for (const winner of winners) {
      await addDebt(loser.id, winner.id, 1, tx);
      debts.push({
        debtorId: loser.id,
        debtorName: loser.name,
        creditorId: winner.id,
        creditorName: winner.name,
        amount: 1,
        reason: "match",
      });
    }
  }

  return debts;
}

/**
 * Record doubles match debts: each winner earns exactly 1 ly nước cam from a loser on the
 * opposing side. Debtors rotate round-robin across losers (not fixed player pairs).
 */
async function recordDoublesMatchDebts(
  competitors: Competitor[],
  winnerSide: ChallengeSide,
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]
): Promise<ChallengeDebtRecord[]> {
  const winners = competitors.filter((c) => c.side === winnerSide);
  const losers = competitors.filter((c) => c.side !== winnerSide);
  const debts: ChallengeDebtRecord[] = [];

  if (winners.length === 0 || losers.length === 0) return debts;

  for (let i = 0; i < winners.length; i++) {
    const winner = winners[i];
    const loser = losers[i % losers.length];
    await addDebt(loser.id, winner.id, 1, tx);
    debts.push({
      debtorId: loser.id,
      debtorName: loser.name,
      creditorId: winner.id,
      creditorName: winner.name,
      amount: 1,
      reason: "match",
    });
  }

  return debts;
}

/**
 * Record 1-1 bet debts.
 * Bet semantics: bettor picks `side` and names `counterparty` — "I bet counterparty that side X wins".
 * - If side X wins: counterparty owes bettor 1 cam.
 * - If side X loses: bettor owes counterparty 1 cam.
 */
async function recordBetDebts(
  bets: Array<{
    bettorId: number;
    counterpartyId: number | null;
    side: string;
    amount: number;
    bettor: { name: string };
    counterparty: { name: string } | null;
  }>,
  winnerSide: ChallengeSide,
  tx: Parameters<Parameters<typeof db.$transaction>[0]>[0]
): Promise<ChallengeDebtRecord[]> {
  const debts: ChallengeDebtRecord[] = [];

  for (const bet of bets) {
    if (bet.counterpartyId == null || !bet.counterparty) continue;

    const betWon = (bet.side as ChallengeSide) === winnerSide;
    const debtorId = betWon ? bet.counterpartyId : bet.bettorId;
    const creditorId = betWon ? bet.bettorId : bet.counterpartyId;
    const debtorName = betWon ? bet.counterparty.name : bet.bettor.name;
    const creditorName = betWon ? bet.bettor.name : bet.counterparty.name;

    await addDebt(debtorId, creditorId, bet.amount, tx);
    debts.push({
      debtorId,
      debtorName,
      creditorId,
      creditorName,
      amount: bet.amount,
      reason: "bet",
    });
  }

  return debts;
}

export async function resolveChallenge(
  challengeId: number,
  winnerSide: ChallengeSide,
  confirmedHandicapPoints: number,
  confirmedScore: string
) {
  return db.$transaction(async (tx) => {
    const challenge = await tx.challenge.findUnique({
      where: { id: challengeId },
      include: {
        ...CHALLENGE_FULL_INCLUDE,
        playerA: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            eloRating: true,
            totalMatches: true,
            totalWins: true,
          },
        },
        playerA2: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            eloRating: true,
            totalMatches: true,
            totalWins: true,
          },
        },
        playerB: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            eloRating: true,
            totalMatches: true,
            totalWins: true,
          },
        },
        playerB2: {
          select: {
            id: true,
            name: true,
            avatarUrl: true,
            eloRating: true,
            totalMatches: true,
            totalWins: true,
          },
        },
        bets: {
          include: {
            bettor: {
              select: { id: true, name: true, avatarUrl: true },
            },
            counterparty: {
              select: { id: true, name: true, avatarUrl: true },
            },
          },
        },
      },
    });

    if (!challenge) {
      throw new Error("NOT_FOUND");
    }
    if (challenge.status !== "ACTIVE") {
      throw new Error("INVALID_STATUS");
    }

    const competitors: Competitor[] = [
      {
        id: challenge.playerA.id,
        name: challenge.playerA.name,
        eloRating: challenge.playerA.eloRating,
        totalMatches: challenge.playerA.totalMatches,
        totalWins: challenge.playerA.totalWins,
        side: "A",
      },
      {
        id: challenge.playerB.id,
        name: challenge.playerB.name,
        eloRating: challenge.playerB.eloRating,
        totalMatches: challenge.playerB.totalMatches,
        totalWins: challenge.playerB.totalWins,
        side: "B",
      },
    ];

    if (challenge.playerA2) {
      competitors.push({
        id: challenge.playerA2.id,
        name: challenge.playerA2.name,
        eloRating: challenge.playerA2.eloRating,
        totalMatches: challenge.playerA2.totalMatches,
        totalWins: challenge.playerA2.totalWins,
        side: "A",
      });
    }
    if (challenge.playerB2) {
      competitors.push({
        id: challenge.playerB2.id,
        name: challenge.playerB2.name,
        eloRating: challenge.playerB2.eloRating,
        totalMatches: challenge.playerB2.totalMatches,
        totalWins: challenge.playerB2.totalWins,
        side: "B",
      });
    }

    const isDoubles = challenge.format === "DOUBLES";
    const eloChanges = isDoubles
      ? []
      : computeEloChanges(competitors, winnerSide);
    const matchDebts =
      challenge.isDrinkChallenge && challenge.bets.length === 0
        ? isDoubles
          ? await recordDoublesMatchDebts(competitors, winnerSide, tx)
          : await recordSinglesMatchDebts(competitors, winnerSide, tx)
        : [];
    const betDebts = await recordBetDebts(challenge.bets, winnerSide, tx);
    const debts = [...matchDebts, ...betDebts];

    if (!isDoubles) {
      for (const change of eloChanges) {
        const competitor = competitors.find((c) => c.id === change.memberId)!;
        const won = competitor.side === winnerSide;
        await tx.member.update({
          where: { id: change.memberId },
          data: {
            eloRating: change.after,
            totalMatches: competitor.totalMatches + 1,
            totalWins: competitor.totalWins + (won ? 1 : 0),
          },
        });
      }
    }

    const resolutionSnapshot: ChallengeResolutionDTO = { eloChanges, debts };
    const winnerId = resolveWinnerId(
      winnerSide,
      challenge.playerAId,
      challenge.playerBId
    );

    // confirmedHandicapPoints + confirmedScore are retained for future Elo / win-rate / handicap calibration.
    const updated = await tx.challenge.update({
      where: { id: challengeId },
      data: {
        status: "COMPLETED",
        winnerSide,
        winnerId,
        completedAt: new Date(),
        handicapPoints: confirmedHandicapPoints,
        confirmedHandicapPoints,
        confirmedScore,
        resolutionSnapshot: resolutionSnapshot as object,
      },
      include: CHALLENGE_FULL_INCLUDE,
    });

    return serializeChallenge(updated);
  });
}

const RESOLVE_PLAYER_SELECT = {
  id: true,
  name: true,
  avatarUrl: true,
  eloRating: true,
  totalMatches: true,
  totalWins: true,
} as const;

type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

async function revertEloFromSnapshot(
  tx: Tx,
  snapshot: ChallengeResolutionDTO
): Promise<void> {
  for (const change of snapshot.eloChanges) {
    const member = await tx.member.findUnique({
      where: { id: change.memberId },
      select: { totalMatches: true, totalWins: true },
    });
    if (!member) continue;

    const won = change.delta > 0;
    await tx.member.update({
      where: { id: change.memberId },
      data: {
        eloRating: change.before,
        totalMatches: Math.max(0, member.totalMatches - 1),
        totalWins: Math.max(0, member.totalWins - (won ? 1 : 0)),
      },
    });
  }
}

function buildCompetitors(challenge: {
  playerA: Omit<Competitor, "side">;
  playerA2: Omit<Competitor, "side"> | null;
  playerB: Omit<Competitor, "side">;
  playerB2: Omit<Competitor, "side"> | null;
}): Competitor[] {
  const competitors: Competitor[] = [
    { ...challenge.playerA, side: "A" },
    { ...challenge.playerB, side: "B" },
  ];
  if (challenge.playerA2) {
    competitors.push({ ...challenge.playerA2, side: "A" });
  }
  if (challenge.playerB2) {
    competitors.push({ ...challenge.playerB2, side: "B" });
  }
  return competitors;
}

export async function adminEditChallengeWinner(
  challengeId: number,
  winnerSide: ChallengeSide
) {
  return db.$transaction(async (tx) => {
    const challenge = await tx.challenge.findUnique({
      where: { id: challengeId },
      include: {
        playerA: { select: RESOLVE_PLAYER_SELECT },
        playerA2: { select: RESOLVE_PLAYER_SELECT },
        playerB: { select: RESOLVE_PLAYER_SELECT },
        playerB2: { select: RESOLVE_PLAYER_SELECT },
      },
    });

    if (!challenge) throw new Error("NOT_FOUND");
    if (challenge.status !== "COMPLETED") throw new Error("INVALID_STATUS");
    if (challenge.winnerSide === winnerSide) throw new Error("SAME_WINNER");

    const snapshot = challenge.resolutionSnapshot as ChallengeResolutionDTO | null;
    const isDoubles = challenge.format === "DOUBLES";

    if (!isDoubles) {
      if (!snapshot?.eloChanges?.length) throw new Error("NO_SNAPSHOT");

      await revertEloFromSnapshot(tx, snapshot);

      const refreshed = await tx.challenge.findUnique({
        where: { id: challengeId },
        include: {
          playerA: { select: RESOLVE_PLAYER_SELECT },
          playerA2: { select: RESOLVE_PLAYER_SELECT },
          playerB: { select: RESOLVE_PLAYER_SELECT },
          playerB2: { select: RESOLVE_PLAYER_SELECT },
        },
      });
      if (!refreshed) throw new Error("NOT_FOUND");

      const competitors = buildCompetitors(refreshed);
      const eloChanges = computeEloChanges(competitors, winnerSide);

      for (const change of eloChanges) {
        const competitor = competitors.find((c) => c.id === change.memberId)!;
        const won = competitor.side === winnerSide;
        await tx.member.update({
          where: { id: change.memberId },
          data: {
            eloRating: change.after,
            totalMatches: competitor.totalMatches + 1,
            totalWins: competitor.totalWins + (won ? 1 : 0),
          },
        });
      }

      const winnerId = resolveWinnerId(
        winnerSide,
        refreshed.playerAId,
        refreshed.playerBId
      );

      const updated = await tx.challenge.update({
        where: { id: challengeId },
        data: {
          winnerSide,
          winnerId,
          resolutionSnapshot: {
            eloChanges,
            debts: snapshot.debts,
          } as object,
        },
        include: CHALLENGE_FULL_INCLUDE,
      });

      return serializeChallenge(updated);
    }

    const winnerId = resolveWinnerId(
      winnerSide,
      challenge.playerAId,
      challenge.playerBId
    );

    const updated = await tx.challenge.update({
      where: { id: challengeId },
      data: {
        winnerSide,
        winnerId,
      },
      include: CHALLENGE_FULL_INCLUDE,
    });

    return serializeChallenge(updated);
  });
}

export async function adminDeleteChallenge(challengeId: number) {
  return db.$transaction(async (tx) => {
    const challenge = await tx.challenge.findUnique({
      where: { id: challengeId },
      select: {
        id: true,
        status: true,
        resolutionSnapshot: true,
      },
    });

    if (!challenge) throw new Error("NOT_FOUND");

    const snapshot = challenge.resolutionSnapshot as ChallengeResolutionDTO | null;
    const debtCount = snapshot?.debts?.length ?? 0;

    if (challenge.status === "COMPLETED" && snapshot?.eloChanges?.length) {
      await revertEloFromSnapshot(tx, snapshot);
    }

    await tx.challenge.delete({ where: { id: challengeId } });

    return { debtCount };
  });
}

export async function startChallenge(challengeId: number) {
  const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
  if (!challenge) throw new Error("NOT_FOUND");
  if (challenge.status !== "PENDING") throw new Error("INVALID_STATUS");

  const updated = await db.challenge.update({
    where: { id: challengeId },
    data: { status: "ACTIVE" },
    include: CHALLENGE_FULL_INCLUDE,
  });

  return serializeChallenge(updated);
}
