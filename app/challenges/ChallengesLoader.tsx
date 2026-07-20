import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { formatDatabaseError, logDatabaseError } from "@/lib/dbHealth";
import { CHALLENGE_LIST_INCLUDE } from "@/lib/challengeIncludes";
import { serializeChallengeList } from "@/lib/challengeSerialize";
import ChallengesPageClient from "./ChallengesPageClient";
import type { ChallengeDTO } from "@/lib/types";

export default async function ChallengesLoader() {
  let challenges: ChallengeDTO[] = [];
  let dbAvailable = false;
  let dbError: string | undefined;

  if (!isDatabaseConfigured()) {
    dbError =
      "POSTGRES_PRISMA_URL is not set. Configure Postgres env vars for kèo and leaderboard features.";
  } else {
    try {
      const raw = await db.challenge.findMany({
        include: CHALLENGE_LIST_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
      challenges = raw.map(serializeChallengeList);
      dbAvailable = true;
    } catch (err) {
      dbError = formatDatabaseError(err);
      logDatabaseError("ChallengesPage", err);
    }
  }

  return (
    <ChallengesPageClient
      initialChallenges={challenges}
      dbAvailable={dbAvailable}
      dbError={dbError}
    />
  );
}
