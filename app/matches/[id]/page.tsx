import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { isSplitwiseConfigured, getCurrencyCode } from "@/lib/splitwise";
import { MATCH_FULL_INCLUDE } from "@/lib/prismaIncludes";
import { toDTO } from "@/lib/serialize";
import MatchDetailClient from "./MatchDetailClient";
import type { MatchDTO, MemberDTO } from "@/lib/types";

export const revalidate = 30;

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
        currencyCode={getCurrencyCode()}
        isManage={isManage}
      />
    );
  }

  let initialMatch: MatchDTO | null = null;
  let initialMembers: MemberDTO[] = [];
  let dbAvailable = false;

  if (isDatabaseConfigured()) {
    try {
      const [rawMatch, rawMembers] = await Promise.all([
        db.match.findUnique({
          where: { id: matchId },
          include: MATCH_FULL_INCLUDE,
        }),
        db.member.findMany({ orderBy: { name: "asc" } }),
      ]);

      if (rawMatch) {
        initialMatch = toDTO<MatchDTO>(rawMatch);
      }
      initialMembers = toDTO<MemberDTO[]>(rawMembers);
      dbAvailable = true;
    } catch {
      // DB unreachable — client falls back to local/API mode
    }
  }

  return (
    <MatchDetailClient
      matchId={matchId}
      initialMatch={initialMatch}
      initialMembers={initialMembers}
      dbAvailable={dbAvailable}
      splitwiseConfigured={isSplitwiseConfigured()}
      currencyCode={getCurrencyCode()}
      isManage={isManage}
    />
  );
}
