import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
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

  if (isDatabaseConfigured() && !isNaN(challengeId)) {
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
    } catch {
      // DB unreachable
    }
  }

  return (
    <ChallengeDetailClient
      challengeId={isNaN(challengeId) ? -1 : challengeId}
      initialChallenge={initialChallenge}
      initialMembers={initialMembers}
      dbAvailable={dbAvailable}
    />
  );
}
