import { db } from "@/lib/db";
import MatchTabs from "@/components/matches/MatchTabs";
import type { MatchDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let upcoming: MatchDTO[] = [];
  let past: MatchDTO[] = [];
  let dbAvailable = false;

  try {
    const raw = await db.match.findMany({
      include: {
        registrations: {
          include: { member: true, guests: true },
          orderBy: { joinedAt: "asc" },
        },
      },
      orderBy: { scheduledAt: "asc" },
    });
    const matches: MatchDTO[] = JSON.parse(JSON.stringify(raw));
    const now = new Date();
    upcoming = matches.filter((m) => new Date(m.scheduledAt) >= now);
    past = matches.filter((m) => new Date(m.scheduledAt) < now).reverse();
    dbAvailable = true;
  } catch {
    // DB not configured — client will load from IndexedDB
  }

  return (
    <div className="mx-auto max-w-lg">
      <MatchTabs upcoming={upcoming} past={past} dbAvailable={dbAvailable} />
    </div>
  );
}
