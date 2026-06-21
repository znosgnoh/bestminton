import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { isSplitwiseConfigured } from "@/lib/splitwise";
import MembersSection from "@/components/management/MembersSection";
import MatchesSection from "@/components/management/MatchesSection";
import type { MemberDTO, MatchDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function ManagementPage() {
  let members: MemberDTO[] = [];
  let matches: MatchDTO[] = [];
  let dbAvailable = false;

  if (isDatabaseConfigured()) {
    const [rawMembers, rawMatches] = await Promise.all([
      db.member.findMany({ orderBy: { name: "asc" } }),
      db.match.findMany({
        include: {
          registrations: {
            include: { member: true, guests: true },
            orderBy: { joinedAt: "asc" },
          },
        },
        orderBy: { scheduledAt: "desc" },
      }),
    ]);
    members = JSON.parse(JSON.stringify(rawMembers));
    matches = JSON.parse(JSON.stringify(rawMatches));
    dbAvailable = true;
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
