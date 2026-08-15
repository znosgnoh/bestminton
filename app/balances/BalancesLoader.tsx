import { db } from "@/lib/db";
import { getCurrencyCode } from "@/lib/currency";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { formatDatabaseError, logDatabaseError, withDbRetry } from "@/lib/dbHealth";
import { getLedgerSnapshot } from "@/lib/ledgerService";
import { toMemberDTO } from "@/lib/memberSerialize";
import BalancesPageClient from "./BalancesPageClient";
import type { LedgerSnapshotDTO, MemberDTO } from "@/lib/types";

const EMPTY_SNAPSHOT: LedgerSnapshotDTO = {
  currency: getCurrencyCode(),
  bridgeOn: false,
  edges: [],
  expenses: [],
};

export default async function BalancesLoader() {
  let snapshot: LedgerSnapshotDTO = EMPTY_SNAPSHOT;
  let members: MemberDTO[] = [];
  let dbAvailable = false;
  let dbError: string | undefined;

  if (!isDatabaseConfigured()) {
    dbError =
      "POSTGRES_PRISMA_URL is not set. Configure Postgres env vars for kèo and leaderboard features.";
  } else {
    try {
      const [snap, rawMembers] = await withDbRetry(() =>
        Promise.all([
          getLedgerSnapshot(),
          db.member.findMany({ orderBy: { name: "asc" } }),
        ])
      );
      snapshot = snap;
      members = rawMembers.map((m) => toMemberDTO(m));
      dbAvailable = true;
    } catch (err) {
      dbError = formatDatabaseError(err);
      logDatabaseError("BalancesPage", err);
    }
  }

  return (
    <BalancesPageClient
      initialSnapshot={snapshot}
      initialMembers={members}
      dbAvailable={dbAvailable}
      dbError={dbError}
    />
  );
}
