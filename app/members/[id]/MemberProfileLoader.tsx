import { isDatabaseConfigured } from "@/lib/dbConfig";
import { formatDatabaseError, logDatabaseError } from "@/lib/dbHealth";
import { buildMemberProfile } from "@/lib/memberProfile";
import MemberProfileClient from "./MemberProfileClient";
import type { MemberProfileDTO } from "@/lib/types";

interface MemberProfileLoaderProps {
  memberIdStr: string;
}

export default async function MemberProfileLoader({ memberIdStr }: MemberProfileLoaderProps) {
  const memberId = parseInt(memberIdStr);

  let profile: MemberProfileDTO | null = null;
  let dbAvailable = false;
  let dbError: string | undefined;

  if (isNaN(memberId)) {
    return <MemberProfileClient profile={null} dbAvailable={false} dbError="Invalid member." />;
  }

  if (!isDatabaseConfigured()) {
    dbError =
      "POSTGRES_PRISMA_URL is not set. Configure Postgres env vars for kèo and leaderboard features.";
  } else {
    try {
      profile = await buildMemberProfile(memberId);
      dbAvailable = true;
    } catch (err) {
      dbError = formatDatabaseError(err);
      logDatabaseError("MemberProfilePage", err);
    }
  }

  return (
    <MemberProfileClient profile={profile} dbAvailable={dbAvailable} dbError={dbError} />
  );
}
