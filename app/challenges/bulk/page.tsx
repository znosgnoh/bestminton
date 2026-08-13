import { db } from "@/lib/db";
import { formatDatabaseError, logDatabaseError, probeDatabase } from "@/lib/dbHealth";
import { membersToDTOs } from "@/lib/memberSerialize";
import BulkChallengePageClient from "./BulkChallengePageClient";
import type { MemberDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function BulkChallengePage() {
  let members: MemberDTO[] = [];
  let dbAvailable = false;
  let dbError: string | undefined;

  const probe = await probeDatabase();
  if (!probe.ok) {
    dbError = probe.message;
    logDatabaseError("BulkChallengePage", probe.message);
  } else {
    try {
      const raw = await db.member.findMany({ orderBy: { name: "asc" } });
      members = await membersToDTOs(raw);
      dbAvailable = true;
    } catch (err) {
      dbError = formatDatabaseError(err);
      logDatabaseError("BulkChallengePage", err);
    }
  }

  return (
    <BulkChallengePageClient members={members} dbAvailable={dbAvailable} dbError={dbError} />
  );
}
