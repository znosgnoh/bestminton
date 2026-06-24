import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDatabase } from "@/lib/apiHelpers";
import { debtSummaryFor, getAllDebtSummaries } from "@/lib/drinkDebt";
import { toMemberDTO } from "@/lib/memberSerialize";
import type { LeaderboardEntryDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  try {
    const [members, summaries] = await Promise.all([
      db.member.findMany({
        orderBy: [{ eloRating: "desc" }, { totalWins: "desc" }, { name: "asc" }],
      }),
      getAllDebtSummaries(),
    ]);

    const entries: LeaderboardEntryDTO[] = members.map((m, index) => ({
      ...toMemberDTO(m, debtSummaryFor(m.id, summaries)),
      rank: index + 1,
      winRate: m.totalMatches > 0 ? m.totalWins / m.totalMatches : 0,
    }));

    return NextResponse.json(entries);
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
