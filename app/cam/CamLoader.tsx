import { isDatabaseConfigured } from "@/lib/dbConfig";
import { formatDatabaseError, logDatabaseError, withDbRetry } from "@/lib/dbHealth";
import { getOjPoolSnapshot } from "@/lib/ojBalance";
import CamPageClient from "./CamPageClient";
import type { OjPoolSnapshotDTO } from "@/lib/types";

export default async function CamLoader() {
  let snapshot: OjPoolSnapshotDTO = { balances: [], transactions: [] };
  let dbAvailable = false;
  let dbError: string | undefined;

  if (!isDatabaseConfigured()) {
    dbError =
      "POSTGRES_PRISMA_URL is not set. Configure Postgres env vars for kèo and leaderboard features.";
  } else {
    try {
      snapshot = await withDbRetry(() => getOjPoolSnapshot());
      dbAvailable = true;
    } catch (err) {
      dbError = formatDatabaseError(err);
      logDatabaseError("CamPage", err);
    }
  }

  return (
    <CamPageClient
      initialSnapshot={snapshot}
      dbAvailable={dbAvailable}
      dbError={dbError}
    />
  );
}
