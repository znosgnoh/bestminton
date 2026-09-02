"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRegisterPullToRefresh } from "@/components/PullToRefresh";
import { useRouter, useSearchParams } from "next/navigation";
import DebtsTable from "@/components/cam/DebtsTable";
import ErrorBanner from "@/components/ui/ErrorBanner";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import PageLoader from "@/components/ui/PageLoader";
import { useI18n } from "@/contexts/LocaleContext";
import * as dataService from "@/lib/dataService";
import type { OjPoolSnapshotDTO } from "@/lib/types";

interface CamPageClientProps {
  initialSnapshot: OjPoolSnapshotDTO;
  dbAvailable: boolean;
  dbError?: string;
}

export default function CamPageClient({
  initialSnapshot,
  dbAvailable,
  dbError,
}: CamPageClientProps) {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const highlightMemberId = searchParams.get("member")
    ? parseInt(searchParams.get("member")!, 10)
    : undefined;
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [available, setAvailable] = useState(dbAvailable);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(dbError ?? null);

  const ownersCount = snapshot.balances.filter(
    (balance) => balance.ojBalance > 0
  ).length;
  const owersCount = snapshot.balances.filter(
    (balance) => balance.ojBalance < 0
  ).length;
  const totalLy = useMemo(
    () =>
      snapshot.balances
        .filter((balance) => balance.ojBalance > 0)
        .reduce((sum, balance) => sum + balance.ojBalance, 0),
    [snapshot.balances]
  );

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const fresh = await dataService.getDebts();
      setSnapshot(fresh);
      setAvailable(true);
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
    setSnapshot(initialSnapshot);
    setAvailable(dbAvailable);
    setError(dbError ?? null);
  }, [initialSnapshot, dbAvailable, dbError]);

  if (!available) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <h1 className="tet-page-title inline-flex items-center gap-2">
          <OrangeJuiceIcon size={24} className="text-orange-500 dark:text-orange-400" />
          {t("cam.title")}
        </h1>
        {loading && <PageLoader />}
        <ErrorBanner
          message={error ?? t("cam.dbRequired")}
          onRetry={refreshDebts}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="tet-page-title inline-flex items-center gap-2">
            <OrangeJuiceIcon size={24} className="text-orange-500 dark:text-orange-400" />
            {t("cam.title")}
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {t("cam.subtitle")}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {ownersCount === 0 && owersCount === 0
              ? t("cam.allSettled")
              : t("cam.poolSummary", {
                  owns: ownersCount,
                  owes: owersCount,
                  total: totalLy,
                })}
          </p>
        </div>
      </div>

      {loading && <PageLoader />}
      {error && <ErrorBanner message={error} onRetry={refreshDebts} />}

      <DebtsTable
        snapshot={snapshot}
        highlightMemberId={
          Number.isFinite(highlightMemberId) ? highlightMemberId : undefined
        }
        onChanged={refreshDebts}
      />
    </div>
  );
}
