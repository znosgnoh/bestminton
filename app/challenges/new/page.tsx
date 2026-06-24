import { db } from "@/lib/db";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { membersToDTOs } from "@/lib/memberSerialize";
import NewChallengePageClient from "./NewChallengePageClient";
import type { MemberDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function NewChallengePage() {
  let members: MemberDTO[] = [];
  let dbAvailable = false;

  if (isDatabaseConfigured()) {
    try {
      const raw = await db.member.findMany({ orderBy: { name: "asc" } });
      members = await membersToDTOs(raw);
      dbAvailable = true;
    } catch {
      // DB unreachable
    }
  }

  return <NewChallengePageClient members={members} dbAvailable={dbAvailable} />;
}
