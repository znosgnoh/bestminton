"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRegisterPullToRefresh } from "@/components/PullToRefresh";
import { useRouter, useSearchParams } from "next/navigation";
import DebtsTable from "@/components/cam/DebtsTable";
import ErrorBanner from "@/components/ui/ErrorBanner";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import PageLoader from "@/components/ui/PageLoader";
import { DRINK_LABEL } from "@/lib/constants";
import { simplifyDebts } from "@/lib/drinkDebtUtils";
import * as dataService from "@/lib/dataService";
import type { DrinkDebtDTO } from "@/lib/types";

interface CamPageClientProps {
  initialDebts: DrinkDebtDTO[];
  dbAvailable: boolean;
}

export default function CamPageClient({ initialDebts, dbAvailable }: CamPageClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightMemberId = searchParams.get("member")
    ? parseInt(searchParams.get("member")!, 10)
    : undefined;
  const [debts, setDebts] = useState(initialDebts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const simplifiedDebts = useMemo(() => simplifyDebts(debts), [debts]);
  const netTotalLy = simplifiedDebts.reduce((sum, d) => sum + d.amount, 0);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await dataService.getDebts();
      setDebts(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load debts.");
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshDebts = useCallback(async () => {
    await fetchDebts();
    router.refresh();
  }, [fetchDebts, router]);

  useRegisterPullToRefresh(fetchDebts);

  useEffect(() => {
    setDebts(initialDebts);
  }, [initialDebts]);

  if (!dbAvailable) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <h1 className="tet-page-title inline-flex items-center gap-2">
          <OrangeJuiceIcon size={24} className="text-orange-500 dark:text-orange-400" />
          {DRINK_LABEL}
        </h1>
        <ErrorBanner message={`${DRINK_LABEL} ledger requires a live database connection.`} />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="tet-page-title inline-flex items-center gap-2">
            <OrangeJuiceIcon size={24} className="text-orange-500 dark:text-orange-400" />
            {DRINK_LABEL}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {simplifiedDebts.length === 0
              ? "All settled — no outstanding debts."
              : `${simplifiedDebts.length} net debt${simplifiedDebts.length === 1 ? "" : "s"} · ${netTotalLy} ly total`}
          </p>
        </div>
      </div>

      {loading && <PageLoader />}
      {error && <ErrorBanner message={error} onRetry={refreshDebts} />}

      <DebtsTable
        debts={debts}
        highlightMemberId={Number.isFinite(highlightMemberId) ? highlightMemberId : undefined}
        onSettled={refreshDebts}
      />
    </div>
  );
}
