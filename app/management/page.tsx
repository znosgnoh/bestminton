import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { isSplitwiseConfigured } from "@/lib/splitwise";
import { MATCH_LIST_INCLUDE } from "@/lib/prismaIncludes";
import { toDTO } from "@/lib/serialize";
import MembersSection from "@/components/management/MembersSection";
import MatchesSection from "@/components/management/MatchesSection";
import type { MemberDTO, MatchDTO } from "@/lib/types";

export const revalidate = 30;

export default async function ManagementPage() {
  let members: MemberDTO[] = [];
  let matches: MatchDTO[] = [];
  let dbAvailable = false;

  if (isDatabaseConfigured()) {
    try {
      const [rawMembers, rawMatches] = await Promise.all([
        db.member.findMany({ orderBy: { name: "asc" } }),
        db.match.findMany({
          include: MATCH_LIST_INCLUDE,
          orderBy: { scheduledAt: "desc" },
        }),
      ]);
      members = toDTO<MemberDTO[]>(rawMembers);
      matches = toDTO<MatchDTO[]>(rawMatches);
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
          Manage team members and schedule matches.
        </p>
      </div>

      <MembersSection
        initialMembers={members}
        dbAvailable={dbAvailable}
        splitwiseConfigured={isSplitwiseConfigured()}
      />
      <MatchesSection initialMatches={matches} dbAvailable={dbAvailable} />
    </div>
  );
}
