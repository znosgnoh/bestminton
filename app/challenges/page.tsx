import { db } from "@/lib/db";
import { formatDatabaseError, logDatabaseError, probeDatabase } from "@/lib/dbHealth";
import { CHALLENGE_LIST_INCLUDE } from "@/lib/challengeIncludes";
import { serializeChallengeList } from "@/lib/challengeSerialize";
import ChallengesPageClient from "./ChallengesPageClient";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  let challenges: ReturnType<typeof serializeChallengeList>[] = [];
  let dbAvailable = false;
  let dbError: string | undefined;

  const probe = await probeDatabase();
  if (!probe.ok) {
    dbError = probe.message;
    logDatabaseError("ChallengesPage", probe.message);
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
