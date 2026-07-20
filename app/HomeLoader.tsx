import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { MATCH_LIST_INCLUDE } from "@/lib/prismaIncludes";
import { toDTO } from "@/lib/serialize";
import MatchTabs from "@/components/matches/MatchTabs";
import type { MatchDTO } from "@/lib/types";

/** Keep home fast: all upcoming + recent past only. */
const PAST_MATCH_LIMIT = 40;

export default async function HomeLoader() {
  let upcoming: MatchDTO[] = [];
  let past: MatchDTO[] = [];
  let dbAvailable = false;

  if (isDatabaseConfigured()) {
    try {
      const now = new Date();
      const [upcomingRaw, pastRaw] = await Promise.all([
        db.match.findMany({
          where: { scheduledAt: { gte: now } },
          include: MATCH_LIST_INCLUDE,
          orderBy: { scheduledAt: "asc" },
        }),
        db.match.findMany({
          where: { scheduledAt: { lt: now } },
          include: MATCH_LIST_INCLUDE,
          orderBy: { scheduledAt: "desc" },
          take: PAST_MATCH_LIMIT,
        }),
      ]);
      upcoming = toDTO<MatchDTO[]>(upcomingRaw);
      past = toDTO<MatchDTO[]>(pastRaw);
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
