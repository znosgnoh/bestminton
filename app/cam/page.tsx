import { Suspense } from "react";
import { isDatabaseConfigured } from "@/lib/dbConfig";
import { getAllDebts } from "@/lib/drinkDebt";
import CamPageClient from "./CamPageClient";
import PageLoader from "@/components/ui/PageLoader";
import type { DrinkDebtDTO } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function CamPage() {
  let debts: DrinkDebtDTO[] = [];
  let dbAvailable = false;

  if (isDatabaseConfigured()) {
    try {
      debts = await getAllDebts();
      dbAvailable = true;
    } catch {
      // DB unreachable
    }
  }

  return (
    <Suspense fallback={<PageLoader />}>
      <CamPageClient initialDebts={debts} dbAvailable={dbAvailable} />
    </Suspense>
  );
}
