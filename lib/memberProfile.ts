import { db } from "@/lib/db";
import { CHALLENGE_LIST_INCLUDE } from "@/lib/challengeIncludes";
import { serializeChallengeList } from "@/lib/challengeSerialize";
import { DEFAULT_ELO } from "@/lib/elo";
import { toMemberDTO } from "@/lib/memberSerialize";
import { summaryFromOjBalance } from "@/lib/ojBalance";
import {
  getShuttlecockFeePerHour,
  shouldCreateShuttlecockRemittance,
  splitSettlementFees,
} from "@/lib/shuttlecock";
import type {
  ChallengeResolutionDTO,
  EloHistoryPointDTO,
  MemberMatchHistoryItemDTO,
  MemberProfileDTO,
  MemberProfileStatsDTO,
} from "@/lib/types";

function memberOnSideA(
  memberId: number,
  challenge: {
    playerAId: number;
    playerA2Id: number | null;
  }
): boolean {
  return challenge.playerAId === memberId || challenge.playerA2Id === memberId;
}

function memberWonChallenge(
  memberId: number,
  challenge: {
    playerAId: number;
    playerA2Id: number | null;
    playerBId: number;
    playerB2Id: number | null;
    winnerSide: string | null;
    winnerId: number | null;
  }
): boolean {
  if (challenge.winnerId === memberId) return true;
  if (!challenge.winnerSide) return false;
  const onA = memberOnSideA(memberId, challenge);
  return (
    (challenge.winnerSide === "A" && onA) || (challenge.winnerSide === "B" && !onA)
  );
}

function opponentNames(
  memberId: number,
  challenge: {
    playerAId: number;
    playerA2Id: number | null;
    playerA: { name: string };
    playerA2: { name: string } | null;
    playerB: { name: string };
    playerB2: { name: string } | null;
  }
): string[] {
  const onA = memberOnSideA(memberId, challenge);
  if (onA) {
    return [challenge.playerB.name, challenge.playerB2?.name].filter(
      (n): n is string => Boolean(n)
    );
  }
  return [challenge.playerA.name, challenge.playerA2?.name].filter(
    (n): n is string => Boolean(n)
  );
}

function parseResolution(raw: unknown): ChallengeResolutionDTO | null {
  if (!raw || typeof raw !== "object") return null;
  const snap = raw as ChallengeResolutionDTO;
  if (!Array.isArray(snap.eloChanges)) return null;
  return snap;
}

export async function buildMemberProfile(memberId: number): Promise<MemberProfileDTO | null> {
  const member = await db.member.findUnique({ where: { id: memberId } });
  if (!member) return null;

  const playerFilter = {
    OR: [
      { playerAId: memberId },
      { playerA2Id: memberId },
      { playerBId: memberId },
      { playerB2Id: memberId },
    ],
  };

  const [debtSummary, higherRatedCount, registrations, challenges] = await Promise.all([
    Promise.resolve(summaryFromOjBalance(member.ojBalance)),
    db.member.count({
      where: {
        OR: [
          { eloRating: { gt: member.eloRating } },
          {
            AND: [{ eloRating: member.eloRating }, { totalWins: { gt: member.totalWins } }],
          },
          {
            AND: [
              { eloRating: member.eloRating },
              { totalWins: member.totalWins },
              { name: { lt: member.name } },
            ],
          },
        ],
      },
    }),
    db.matchRegistration.findMany({
      where: { memberId },
      include: {
        match: {
          include: {
            paidBy: { select: { id: true, name: true } },
            shuttlecockRecipient: { select: { id: true, name: true } },
          },
        },
        guests: true,
      },
      orderBy: { match: { scheduledAt: "desc" } },
    }),
    db.challenge.findMany({
      where: playerFilter,
      include: CHALLENGE_LIST_INCLUDE,
      orderBy: [{ completedAt: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  const memberDto = toMemberDTO(member, debtSummary);

  const matchHistory: MemberMatchHistoryItemDTO[] = registrations.map((reg) => {
    const m = reg.match;
    const hasSettlement =
      m.totalCost != null && m.totalCost > 0 && m.hours != null && m.hours > 0;
    const split = hasSettlement
      ? splitSettlementFees(m.totalCost!, m.hours!, getShuttlecockFeePerHour())
      : null;
    const shuttlecockRemittance = Boolean(
      split &&
        shouldCreateShuttlecockRemittance({
          title: m.title,
          shuttlecockFee: split.shuttlecockFee,
          paidByMemberId: m.paidByMemberId,
          shuttlecockRecipientMemberId: m.shuttlecockRecipientMemberId,
        })
    );

    return {
      matchId: reg.matchId,
      title: m.title,
      venue: m.venue,
      scheduledAt: m.scheduledAt.toISOString(),
      playedFull: reg.playedFull,
      guestCount: reg.guests.length,
      synced: m.synced,
      hours: m.hours,
      totalCost: m.totalCost,
      paidByMemberId: m.paidByMemberId,
      paidByName: m.paidBy?.name ?? null,
      shuttlecockRecipientMemberId: m.shuttlecockRecipientMemberId,
      shuttlecockRecipientName: m.shuttlecockRecipient?.name ?? null,
      shuttlecockFee: split?.shuttlecockFee ?? null,
      courtFee: split?.courtFee ?? null,
      shuttlecockRemittance,
    };
  });

  const challengeHistory = challenges.map(serializeChallengeList);

  const completed = challenges.filter((c) => c.status === "COMPLETED");
  const singles = completed.filter((c) => c.format === "SINGLES");
  const doubles = completed.filter((c) => c.format === "DOUBLES");

  const singlesWins = singles.filter((c) => memberWonChallenge(memberId, c)).length;
  const doublesWins = doubles.filter((c) => memberWonChallenge(memberId, c)).length;

  const eloPointsAsc: EloHistoryPointDTO[] = [];
  for (const challenge of [...singles].sort(
    (a, b) =>
      (a.completedAt?.getTime() ?? a.createdAt.getTime()) -
      (b.completedAt?.getTime() ?? b.createdAt.getTime())
  )) {
    const resolution = parseResolution(challenge.resolutionSnapshot);
    const change = resolution?.eloChanges.find((e) => e.memberId === memberId);
    if (!change || !challenge.completedAt) continue;

    eloPointsAsc.push({
      challengeId: challenge.id,
      completedAt: challenge.completedAt.toISOString(),
      before: change.before,
      after: change.after,
      delta: change.delta,
      won: memberWonChallenge(memberId, challenge),
      score: challenge.confirmedScore ?? null,
      opponentNames: opponentNames(memberId, challenge),
      format: "SINGLES",
    });
  }

  const eloValues = [
    DEFAULT_ELO,
    ...eloPointsAsc.map((p) => p.after),
    member.eloRating,
  ];

  const stats: MemberProfileStatsDTO = {
    sessionsPlayed: matchHistory.length,
    singlesPlayed: singles.length,
    singlesWins,
    doublesPlayed: doubles.length,
    doublesWins,
    peakElo: Math.max(...eloValues),
    lowestElo: Math.min(...eloValues),
  };

  return {
    member: memberDto,
    rank: higherRatedCount + 1,
    winRate: member.totalMatches > 0 ? member.totalWins / member.totalMatches : 0,
    stats,
    matchHistory,
    challengeHistory,
    eloHistory: eloPointsAsc,
  };
}
