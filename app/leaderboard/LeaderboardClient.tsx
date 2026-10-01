"use client";

import { useCallback, useEffect, useState } from "react";
import { Crown } from "lucide-react";
import LeaderboardPodium from "@/components/leaderboard/LeaderboardPodium";
import LeaderboardTable from "@/components/leaderboard/LeaderboardTable";
import PlayerSpotlights from "@/components/leaderboard/PlayerSpotlights";
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
        <p className="mt-1 text-sm text-gray-600 dark:text-slate-400">{t("leaderboard.subtitle")}</p>
        <p className="tet-script mt-1 text-base text-amber-600 dark:text-amber-300">
          {t("leaderboard.brandTagline")}
        </p>
      </div>
      <EloGuideline />
      {!dbAvailable ? (
        <ErrorBanner message={t("leaderboard.dbRequired")} />
      ) : (
        <>
          <LeaderboardPodium entries={entries} />
          <PlayerSpotlights entries={entries} />
          <LeaderboardTable entries={entries} />
          <footer className="pt-2 pb-4 text-center">
            <div className="inline-flex items-center gap-2">
              <Crown size={14} className="text-amber-500 dark:text-amber-300" aria-hidden />
              <p className="font-heading text-lg font-bold tracking-wide text-amber-700 dark:text-amber-300">
                {t("leaderboard.footerTitle")}
              </p>
            </div>
            <p className="tet-script mt-0.5 text-base text-amber-600/90 dark:text-amber-200/80">
              {t("leaderboard.footerTagline")}
            </p>
          </footer>
        </>
      )}
    </div>
  );
}
