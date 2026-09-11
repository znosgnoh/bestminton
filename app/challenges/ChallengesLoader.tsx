import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { formatDatabaseError, logDatabaseError } from "@/lib/dbHealth";
import { CHALLENGE_LIST_INCLUDE } from "@/lib/challengeIncludes";
import { serializeChallengeList } from "@/lib/challengeSerialize";
import { LIVE_CHALLENGE_STATUSES } from "@/lib/challengeListUtils";
import ChallengesPageClient from "./ChallengesPageClient";
import type { ChallengeDTO } from "@/lib/types";

export default async function ChallengesLoader() {
  let challenges: ChallengeDTO[] = [];
  let completedCount = 0;
  let dbAvailable = false;
  let dbError: string | undefined;

  if (!isDatabaseConfigured()) {
    dbError =
      "POSTGRES_PRISMA_URL is not set. Configure Postgres env vars for kèo and leaderboard features.";
  } else {
    try {
      const [raw, completed] = await Promise.all([
        db.challenge.findMany({
          where: { status: { in: [...LIVE_CHALLENGE_STATUSES] } },
          include: CHALLENGE_LIST_INCLUDE,
          orderBy: { createdAt: "desc" },
        }),
        db.challenge.count({ where: { status: "COMPLETED" } }),
      ]);
      challenges = raw.map(serializeChallengeList);
      completedCount = completed;
      dbAvailable = true;
    } catch (err) {
      dbError = formatDatabaseError(err);
      logDatabaseError("ChallengesPage", err);
    }
  }

  return (
    <ChallengesPageClient
      initialChallenges={challenges}
      initialCompletedCount={completedCount}
      dbAvailable={dbAvailable}
      dbError={dbError}
    />
  );
}
