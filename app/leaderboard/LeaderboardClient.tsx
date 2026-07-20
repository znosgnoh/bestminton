"use client";

import { useCallback, useEffect, useState } from "react";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import EloGuideline from "@/components/leaderboard/EloGuideline";
import { useRegisterPullToRefresh } from "@/components/PullToRefresh";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useI18n } from "@/contexts/LocaleContext";
import * as dataService from "@/lib/dataService";
import type { LeaderboardEntryDTO } from "@/lib/types";

interface LeaderboardClientProps {
  entries: LeaderboardEntryDTO[];
  dbAvailable: boolean;
}

export default function LeaderboardClient({
  entries: initialEntries,
  dbAvailable,
}: LeaderboardClientProps) {
  const { t } = useI18n();
  const [entries, setEntries] = useState(initialEntries);

  useEffect(() => {
    setEntries(initialEntries);
  }, [initialEntries]);

  const refreshLeaderboard = useCallback(async () => {
    const next = await dataService.getLeaderboard();
    setEntries(next);
  }, []);

  useRegisterPullToRefresh(refreshLeaderboard);

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <div>
        <h1 className="tet-page-title">{t("leaderboard.title")}</h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">{t("leaderboard.subtitle")}</p>
      </div>
      <EloGuideline />
      {!dbAvailable ? (
        <ErrorBanner message={t("leaderboard.dbRequired")} />
      ) : (
        <LeaderboardTable entries={entries} />
      )}
    </div>
  );
}
