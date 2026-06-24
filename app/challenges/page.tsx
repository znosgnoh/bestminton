import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { CHALLENGE_LIST_INCLUDE } from "@/lib/challengeIncludes";
import { serializeChallengeList } from "@/lib/challengeSerialize";
import ChallengesPageClient from "./ChallengesPageClient";

export const dynamic = "force-dynamic";

export default async function ChallengesPage() {
  let challenges: ReturnType<typeof serializeChallengeList>[] = [];
  let dbAvailable = false;

  if (isDatabaseConfigured()) {
    try {
      const raw = await db.challenge.findMany({
        include: CHALLENGE_LIST_INCLUDE,
        orderBy: { createdAt: "desc" },
      });
      challenges = raw.map(serializeChallengeList);
      dbAvailable = true;
    } catch {
      // DB unreachable
    }
  }

  return <ChallengesPageClient initialChallenges={challenges} dbAvailable={dbAvailable} />;
}
