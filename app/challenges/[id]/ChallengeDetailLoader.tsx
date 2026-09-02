import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { formatDatabaseError, logDatabaseError } from "@/lib/dbHealth";
import { CHALLENGE_FULL_INCLUDE } from "@/lib/challengeIncludes";
import { serializeChallenge } from "@/lib/challengeSerialize";
import { purgeStalePendingChallenges } from "@/lib/challengeService";
import { debtSummaryFor, getAllDebtSummaries } from "@/lib/ojBalance";
import { toMemberDTO } from "@/lib/memberSerialize";
import ChallengeDetailClient from "./ChallengeDetailClient";
import type { ChallengeDTO, MemberDTO } from "@/lib/types";

interface ChallengeDetailLoaderProps {
  challengeIdStr: string;
}

export default async function ChallengeDetailLoader({
  challengeIdStr,
}: ChallengeDetailLoaderProps) {
  const challengeId = parseInt(challengeIdStr);

  let initialChallenge: ChallengeDTO | null = null;
  let initialMembers: MemberDTO[] = [];
  let dbAvailable = false;
  let dbError: string | undefined;

  if (isNaN(challengeId)) {
    return (
      <ChallengeDetailClient
        challengeId={-1}
        initialChallenge={null}
        initialMembers={[]}
        dbAvailable={false}
        dbError="Invalid challenge."
      />
    );
  }

  if (!isDatabaseConfigured()) {
    dbError =
      "POSTGRES_PRISMA_URL is not set. Configure Postgres env vars for kèo and leaderboard features.";
  } else {
    try {
      await purgeStalePendingChallenges();
      const [rawChallenge, rawMembers, summaries] = await Promise.all([
        db.challenge.findUnique({
          where: { id: challengeId },
          include: CHALLENGE_FULL_INCLUDE,
        }),
        db.member.findMany({ orderBy: { name: "asc" } }),
        getAllDebtSummaries(),
      ]);

      if (rawChallenge) {
        initialChallenge = serializeChallenge(rawChallenge);
      }
      initialMembers = rawMembers.map((m) => toMemberDTO(m, debtSummaryFor(m.id, summaries)));
      dbAvailable = true;
    } catch (err) {
      dbError = formatDatabaseError(err);
      logDatabaseError("ChallengeDetailPage", err);
    }
  }

  return (
    <ChallengeDetailClient
      challengeId={challengeId}
      initialChallenge={initialChallenge}
      initialMembers={initialMembers}
      dbAvailable={dbAvailable}
      dbError={dbError}
    />
  );
}
