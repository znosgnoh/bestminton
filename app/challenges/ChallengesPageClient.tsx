"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Plus } from "lucide-react";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import ChallengeDayGroups from "@/components/challenges/ChallengeDayGroups";
import ChallengeListSections from "@/components/challenges/ChallengeListSections";
import EloGuidelineLink from "@/components/leaderboard/EloGuidelineLink";
import { useRegisterPullToRefresh } from "@/components/PullToRefresh";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useI18n } from "@/contexts/LocaleContext";
import { LIVE_CHALLENGE_STATUS_QUERY } from "@/lib/challengeListUtils";
import * as dataService from "@/lib/dataService";
import type { ChallengeDTO } from "@/lib/types";

type FilterStatus = "ALL" | "PENDING" | "ACTIVE" | "COMPLETED";

interface ChallengesPageClientProps {
  initialChallenges: ChallengeDTO[];
  initialCompletedCount: number;
  dbAvailable: boolean;
  dbError?: string;
}

export default function ChallengesPageClient({
  initialChallenges,
  initialCompletedCount,
  dbAvailable,
  dbError,
}: ChallengesPageClientProps) {
  const { t } = useI18n();
  const [liveChallenges, setLiveChallenges] = useState(initialChallenges);
  const [completedChallenges, setCompletedChallenges] = useState<ChallengeDTO[] | null>(null);
  const [completedCount, setCompletedCount] = useState(initialCompletedCount);
  const [completedLoading, setCompletedLoading] = useState(false);
  const [completedError, setCompletedError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>("ALL");
  const completedChallengesRef = useRef(completedChallenges);
  const completedLoadingRef = useRef(false);
  completedChallengesRef.current = completedChallenges;

  useEffect(() => {
    setLiveChallenges(initialChallenges);
    setCompletedCount(initialCompletedCount);
    setCompletedChallenges(null);
    completedChallengesRef.current = null;
    setCompletedError(null);
  }, [initialChallenges, initialCompletedCount]);

  const loadCompleted = useCallback(
    async (force = false) => {
      if (!force && (completedChallengesRef.current !== null || completedLoadingRef.current)) {
        return;
      }
      completedLoadingRef.current = true;
      setCompletedLoading(true);
      setCompletedError(null);
      try {
        const rows = await dataService.getChallenges("COMPLETED");
        completedChallengesRef.current = rows;
        setCompletedChallenges(rows);
        setCompletedCount(rows.length);
      } catch (err) {
        setCompletedError(
          err instanceof Error ? err.message : t("challenges.loadHistoryFailed")
        );
      } finally {
        completedLoadingRef.current = false;
        setCompletedLoading(false);
      }
    },
    [t]
  );

  const refreshChallenges = useCallback(async () => {
    const historyAlreadyOpen = completedChallengesRef.current !== null;
    const [live, history] = await Promise.all([
      dataService.getChallenges(LIVE_CHALLENGE_STATUS_QUERY),
      historyAlreadyOpen ? dataService.getChallenges("COMPLETED") : Promise.resolve(null),
    ]);
    setLiveChallenges(live);
    if (history) {
      completedChallengesRef.current = history;
      setCompletedChallenges(history);
      setCompletedCount(history.length);
    }
  }, []);

  useRegisterPullToRefresh(refreshChallenges);

  useEffect(() => {
    if (filter === "COMPLETED" && (completedCount > 0 || completedChallenges !== null)) {
      void loadCompleted();
    }
  }, [filter, loadCompleted, completedCount, completedChallenges]);

  const filterLabels: Record<FilterStatus, string> = {
    ALL: t("challenges.filterAll"),
    PENDING: t("status.pending"),
    ACTIVE: t("status.active"),
    COMPLETED: t("status.completed"),
  };

  if (!dbAvailable) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <h1 className="tet-page-title">{t("challenges.title")}</h1>
        <ErrorBanner message={dbError ?? t("challenges.dbRequired")} />
      </div>
    );
  }

  const completedTotal = completedChallenges?.length ?? completedCount;
  const liveFiltered =
    filter === "ALL" || filter === "COMPLETED"
      ? liveChallenges
      : liveChallenges.filter((c) => c.status === filter);
  const isEmpty =
    filter === "COMPLETED"
      ? completedTotal === 0 && !completedLoading
      : filter === "ALL"
        ? liveChallenges.length === 0 && completedTotal === 0
        : liveFiltered.length === 0;

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="tet-page-title">{t("challenges.title")}</h1>
          <EloGuidelineLink className="mt-1" />
        </div>
        <div className="flex flex-col items-stretch gap-2 shrink-0">
          <Link
            href="/challenges/new"
            className="tet-btn-primary flex items-center justify-center gap-1.5 px-3 py-2 text-sm"
          >
            <Plus size={16} />
            {t("challenges.newKeo")}
          </Link>
          <Link
            href="/challenges/bulk"
            className="tet-btn-ghost flex items-center justify-center gap-1.5 px-3 py-2 text-sm"
          >
            <Plus size={16} />
            {t("challenges.bulkKeo")}
          </Link>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {(["ALL", "PENDING", "ACTIVE", "COMPLETED"] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={
              filter === s ? "tet-tab-active tet-tab shrink-0" : "tet-tab-inactive tet-tab shrink-0"
            }
          >
            {filterLabels[s]}
          </button>
        ))}
      </div>

      {isEmpty ? (
        <div className="tet-empty">
          <p>{t("challenges.noKeo")}</p>
          <Link href="/challenges/new" className="tet-link-accent mt-2 inline-block">
            {t("challenges.firstKeo")}
          </Link>
        </div>
      ) : filter === "ALL" ? (
        <ChallengeListSections
          challenges={liveChallenges}
          completedChallenges={completedChallenges}
          completedCount={completedCount}
          completedLoading={completedLoading}
          completedError={completedError}
          onRequestCompleted={() => void loadCompleted()}
        />
      ) : filter === "COMPLETED" ? (
        completedError ? (
          <ErrorBanner message={completedError} onRetry={() => void loadCompleted(true)} />
        ) : completedLoading && completedChallenges === null ? (
          <div className="flex justify-center py-8">
            <Loader2 size={24} className="animate-spin text-emerald-600" />
            <span className="sr-only">{t("common.loading")}</span>
          </div>
        ) : (
          <ChallengeDayGroups challenges={completedChallenges ?? []} />
        )
      ) : (
        <div className="space-y-3">
          {liveFiltered.map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
      )}
    </div>
  );
}
