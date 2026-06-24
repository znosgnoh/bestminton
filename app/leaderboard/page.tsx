import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { debtSummaryFor, getAllDebtSummaries } from "@/lib/drinkDebt";
import { toMemberDTO } from "@/lib/memberSerialize";
import LeaderboardTable from "@/components/challenges/LeaderboardTable";
import ErrorBanner from "@/components/ui/ErrorBanner";
import type { LeaderboardEntryDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function LeaderboardPage() {
  let entries: LeaderboardEntryDTO[] = [];
  let dbAvailable = false;

  if (isDatabaseConfigured()) {
    try {
      const [members, summaries] = await Promise.all([
        db.member.findMany({
          orderBy: [{ eloRating: "desc" }, { totalWins: "desc" }, { name: "asc" }],
        }),
        getAllDebtSummaries(),
      ]);

      entries = members.map((m, index) => ({
        ...toMemberDTO(m, debtSummaryFor(m.id, summaries)),
        rank: index + 1,
        winRate: m.totalMatches > 0 ? m.totalWins / m.totalMatches : 0,
      }));
      dbAvailable = true;
    } catch {
      // DB unreachable
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <h1 className="tet-page-title">Leaderboard</h1>
      {!dbAvailable ? (
        <ErrorBanner message="Leaderboard requires a live database connection." />
      ) : (
        <LeaderboardTable entries={entries} />
      )}
    </div>
  );
}
