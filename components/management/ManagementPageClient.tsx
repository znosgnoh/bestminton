"use client";

import MembersSection from "@/components/management/MembersSection";
import MatchesSection from "@/components/management/MatchesSection";
import ChallengesSection from "@/components/management/ChallengesSection";
import ManagementGate from "@/components/management/ManagementGate";
import type { MemberDTO, MatchDTO, ChallengeDTO } from "@/lib/types";

interface ManagementPageClientProps {
  initialMembers: MemberDTO[];
  initialMatches: MatchDTO[];
  completedChallenges: ChallengeDTO[];
  dbAvailable: boolean;
  splitwiseConfigured: boolean;
}

export default function ManagementPageClient({
  initialMembers,
  initialMatches,
  completedChallenges,
  dbAvailable,
  splitwiseConfigured,
}: ManagementPageClientProps) {
  return (
    <ManagementGate>
      <div className="mx-auto max-w-lg px-4 py-6 space-y-8">
        <div>
          <h1 className="tet-page-title">Management</h1>
          <p className="mt-1 tet-muted">
            Quản lý thành viên, trận và lịch sử kèo.
          </p>
        </div>

        <MembersSection
          initialMembers={initialMembers}
          dbAvailable={dbAvailable}
          splitwiseConfigured={splitwiseConfigured}
        />
        <ChallengesSection
          initialChallenges={completedChallenges}
          dbAvailable={dbAvailable}
        />
        <MatchesSection initialMatches={initialMatches} dbAvailable={dbAvailable} />
      </div>
    </ManagementGate>
  );
}
