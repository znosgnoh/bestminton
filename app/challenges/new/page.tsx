import { db } from "@/lib/db";
import { formatDatabaseError, logDatabaseError, probeDatabase } from "@/lib/dbHealth";
import { membersToDTOs } from "@/lib/memberSerialize";
import NewChallengePageClient from "./NewChallengePageClient";
import type { MemberDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewChallengePage() {
  let members: MemberDTO[] = [];
  let dbAvailable = false;
  let dbError: string | undefined;

  const probe = await probeDatabase();
  if (!probe.ok) {
    dbError = probe.message;
    logDatabaseError("NewChallengePage", probe.message);
  } else {
    try {
      const raw = await db.member.findMany({ orderBy: { name: "asc" } });
      members = await membersToDTOs(raw);
      dbAvailable = true;
    } catch (err) {
      dbError = formatDatabaseError(err);
      logDatabaseError("NewChallengePage", err);
    }
  }

  return (
    <NewChallengePageClient members={members} dbAvailable={dbAvailable} dbError={dbError} />
  );
}
