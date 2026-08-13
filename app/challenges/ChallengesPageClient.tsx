"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import ChallengeDayGroups from "@/components/challenges/ChallengeDayGroups";
import ChallengeListSections from "@/components/challenges/ChallengeListSections";
import EloGuidelineLink from "@/components/leaderboard/EloGuidelineLink";
import { useRegisterPullToRefresh } from "@/components/PullToRefresh";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useI18n } from "@/contexts/LocaleContext";
import * as dataService from "@/lib/dataService";
import type { ChallengeDTO } from "@/lib/types";

type FilterStatus = "ALL" | "PENDING" | "ACTIVE" | "COMPLETED";

interface ChallengesPageClientProps {
  initialChallenges: ChallengeDTO[];
  dbAvailable: boolean;
  dbError?: string;
}

export default function ChallengesPageClient({
  initialChallenges,
  dbAvailable,
  dbError,
}: ChallengesPageClientProps) {
  const { t } = useI18n();
  const [challenges, setChallenges] = useState(initialChallenges);
  const [filter, setFilter] = useState<FilterStatus>("ALL");

  useEffect(() => {
    setChallenges(initialChallenges);
  }, [initialChallenges]);

  const refreshChallenges = useCallback(async () => {
    const next = await dataService.getChallenges();
    setChallenges(next);
  }, []);

  useRegisterPullToRefresh(refreshChallenges);

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

  const filtered =
    filter === "ALL" ? challenges : challenges.filter((c) => c.status === filter);

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

      {filtered.length === 0 ? (
        <div className="tet-empty">
          <p>{t("challenges.noKeo")}</p>
          <Link href="/challenges/new" className="tet-link-accent mt-2 inline-block">
            {t("challenges.firstKeo")}
          </Link>
        </div>
      ) : filter === "ALL" ? (
        <ChallengeListSections challenges={filtered} />
      ) : filter === "COMPLETED" ? (
        <ChallengeDayGroups challenges={filtered} />
      ) : (
        <div className="space-y-3">
          {filtered.map((c) => (
            <ChallengeCard key={c.id} challenge={c} />
          ))}
        </div>
      )}
    </div>
  );
}
