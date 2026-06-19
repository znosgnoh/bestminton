import { db } from "@/lib/db";
import { isSplitwiseConfigured } from "@/lib/splitwise";
import MatchDetailClient from "./MatchDetailClient";
import type { MatchDTO, MemberDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function MatchPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ manage?: string }>;
}) {
  const [{ id: idStr }, sp] = await Promise.all([params, searchParams]);
  const matchId = parseInt(idStr);
  const isManage = sp.manage === "1";

  // Pass NaN matchId to client — it will show "not found" gracefully
  if (isNaN(matchId)) {
    return (
      <MatchDetailClient
        matchId={-1}
        initialMatch={null}
        initialMembers={[]}
        dbAvailable={false}
        splitwiseConfigured={isSplitwiseConfigured()}
        isManage={isManage}
      />
    );
  }

  let initialMatch: MatchDTO | null = null;
  let initialMembers: MemberDTO[] = [];
  let dbAvailable = false;

  try {
    const [rawMatch, rawMembers] = await Promise.all([
      db.match.findUnique({
        where: { id: matchId },
        include: {
          registrations: {
            include: { member: true, guests: true },
            orderBy: { joinedAt: "asc" },
          },
        },
      }),
      db.member.findMany({ orderBy: { name: "asc" } }),
    ]);

    if (rawMatch) {
      initialMatch = JSON.parse(JSON.stringify(rawMatch));
      dbAvailable = true;
    }
    initialMembers = JSON.parse(JSON.stringify(rawMembers));
  } catch {
    // DB not available — client will load from IndexedDB
  }

  return (
    <MatchDetailClient
      matchId={matchId}
      initialMatch={initialMatch}
      initialMembers={initialMembers}
      dbAvailable={dbAvailable}
      splitwiseConfigured={isSplitwiseConfigured()}
      isManage={isManage}
    />
  );
}
