import { isDatabaseConfigured } from "@/lib/dbConfig";
import { getAllDebts } from "@/lib/drinkDebt";
import CamPageClient from "./CamPageClient";
import type { DrinkDebtDTO } from "@/lib/types";

export default async function CamLoader() {
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

  return <CamPageClient initialDebts={debts} dbAvailable={dbAvailable} />;
}
