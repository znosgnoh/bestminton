import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { isSplitwiseConfigured } from "@/lib/splitwise";
import { MATCH_LIST_INCLUDE } from "@/lib/prismaIncludes";
import { CHALLENGE_LIST_INCLUDE } from "@/lib/challengeIncludes";
import { membersToDTOs } from "@/lib/memberSerialize";
import { serializeChallengeList } from "@/lib/challengeSerialize";
import { toDTO } from "@/lib/serialize";
import MembersSection from "@/components/management/MembersSection";
import MatchesSection from "@/components/management/MatchesSection";
import ChallengesSection from "@/components/management/ChallengesSection";
import type { MemberDTO, MatchDTO, ChallengeDTO } from "@/lib/types";

export const revalidate = 30;

export default async function ManagementPage() {
  let members: MemberDTO[] = [];
  let matches: MatchDTO[] = [];
  let completedChallenges: ChallengeDTO[] = [];
  let dbAvailable = false;

  if (isDatabaseConfigured()) {
    try {
      const [rawMembers, rawMatches, rawChallenges] = await Promise.all([
        db.member.findMany({ orderBy: { name: "asc" } }),
        db.match.findMany({
          include: MATCH_LIST_INCLUDE,
          orderBy: { scheduledAt: "desc" },
        }),
        db.challenge.findMany({
          where: { status: "COMPLETED" },
          include: CHALLENGE_LIST_INCLUDE,
          orderBy: { completedAt: "desc" },
        }),
      ]);
      members = await membersToDTOs(rawMembers);
      matches = toDTO<MatchDTO[]>(rawMatches);
      completedChallenges = rawChallenges.map(serializeChallengeList);
      dbAvailable = true;
    } catch {
      // DB unreachable — client falls back to local/API mode
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-6 space-y-8">
      <div>
        <h1 className="tet-page-title">Management</h1>
        <p className="mt-1 tet-muted">
          Quản lý thành viên, trận và lịch sử kèo.
        </p>
      </div>

      <MembersSection
        initialMembers={members}
        dbAvailable={dbAvailable}
        splitwiseConfigured={isSplitwiseConfigured()}
      />
      <ChallengesSection
        initialChallenges={completedChallenges}
        dbAvailable={dbAvailable}
      />
      <MatchesSection initialMatches={matches} dbAvailable={dbAvailable} />
    </div>
  );
}
