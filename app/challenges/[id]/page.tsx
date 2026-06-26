import { db } from "@/lib/db";
import { formatDatabaseError, logDatabaseError, probeDatabase } from "@/lib/dbHealth";
import { CHALLENGE_FULL_INCLUDE } from "@/lib/challengeIncludes";
import { serializeChallenge } from "@/lib/challengeSerialize";
import { membersToDTOs } from "@/lib/memberSerialize";
import ChallengeDetailClient from "./ChallengeDetailClient";
import type { ChallengeDTO, MemberDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ChallengeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: idStr } = await params;
  const challengeId = parseInt(idStr);

  let initialChallenge: ChallengeDTO | null = null;
  let initialMembers: MemberDTO[] = [];
  let dbAvailable = false;
  let dbError: string | undefined;

  if (!isNaN(challengeId)) {
    const probe = await probeDatabase();
    if (!probe.ok) {
      dbError = probe.message;
      logDatabaseError("ChallengeDetailPage", probe.message);
    } else {
      try {
        const [rawChallenge, rawMembers] = await Promise.all([
          db.challenge.findUnique({
            where: { id: challengeId },
            include: CHALLENGE_FULL_INCLUDE,
          }),
          db.member.findMany({ orderBy: { name: "asc" } }),
        ]);

        if (rawChallenge) {
          initialChallenge = serializeChallenge(rawChallenge);
        }
        initialMembers = await membersToDTOs(rawMembers);
        dbAvailable = true;
      } catch (err) {
        dbError = formatDatabaseError(err);
        logDatabaseError("ChallengeDetailPage", err);
      }
    }
  }

  return (
    <ChallengeDetailClient
      challengeId={isNaN(challengeId) ? -1 : challengeId}
      initialChallenge={initialChallenge}
      initialMembers={initialMembers}
      dbAvailable={dbAvailable}
      dbError={dbError}
    />
  );
}
