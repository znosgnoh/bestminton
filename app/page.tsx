import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { MATCH_LIST_INCLUDE } from "@/lib/prismaIncludes";
import { toDTO } from "@/lib/serialize";
import MatchTabs from "@/components/matches/MatchTabs";
import type { MatchDTO } from "@/lib/types";

export const revalidate = 30;

export default async function HomePage() {
  let upcoming: MatchDTO[] = [];
  let past: MatchDTO[] = [];
  let dbAvailable = false;

  if (isDatabaseConfigured()) {
    try {
      const raw = await db.match.findMany({
        include: MATCH_LIST_INCLUDE,
        orderBy: { scheduledAt: "asc" },
      });
      const matches = toDTO<MatchDTO[]>(raw);
      const now = new Date();
      upcoming = matches.filter((m) => new Date(m.scheduledAt) >= now);
      past = matches.filter((m) => new Date(m.scheduledAt) < now).reverse();
      dbAvailable = true;
    } catch {
      // DB unreachable at build or runtime — fall back to client-side local mode
    }
  }

  return (
    <div className="mx-auto max-w-lg">
      <MatchTabs upcoming={upcoming} past={past} dbAvailable={dbAvailable} />
    </div>
  );
}
