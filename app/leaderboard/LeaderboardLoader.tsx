import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { debtSummaryFor, getAllDebtSummaries } from "@/lib/drinkDebt";
import { toMemberDTO } from "@/lib/memberSerialize";
import LeaderboardClient from "./LeaderboardClient";
import type { LeaderboardEntryDTO } from "@/lib/types";

export default async function LeaderboardLoader() {
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

  return <LeaderboardClient entries={entries} dbAvailable={dbAvailable} />;
}
