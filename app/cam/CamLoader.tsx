import { isDatabaseConfigured } from "@/lib/dbConfig";
import { formatDatabaseError, logDatabaseError, withDbRetry } from "@/lib/dbHealth";
import { getAllDebts } from "@/lib/ojBalance";
import CamPageClient from "./CamPageClient";
import type { DrinkDebtDTO } from "@/lib/types";

export default async function CamLoader() {
  let debts: DrinkDebtDTO[] = [];
  let dbAvailable = false;
  let dbError: string | undefined;

  if (!isDatabaseConfigured()) {
    dbError =
      "POSTGRES_PRISMA_URL is not set. Configure Postgres env vars for kèo and leaderboard features.";
  } else {
    try {
      debts = await withDbRetry(() => getAllDebts());
      dbAvailable = true;
    } catch (err) {
      dbError = formatDatabaseError(err);
      logDatabaseError("CamPage", err);
    }
  }

  return (
    <CamPageClient initialDebts={debts} dbAvailable={dbAvailable} dbError={dbError} />
  );
}
