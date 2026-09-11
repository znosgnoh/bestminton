"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import ChallengeDayGroups from "@/components/challenges/ChallengeDayGroups";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useI18n } from "@/contexts/LocaleContext";
import type { ChallengeDTO, ChallengeStatus } from "@/lib/types";

const SECTION_ORDER: ChallengeStatus[] = ["ACTIVE", "PENDING", "COMPLETED"];

interface ChallengeListSectionsProps {
  challenges: ChallengeDTO[];
  completedChallenges?: ChallengeDTO[] | null;
  completedCount?: number;
  completedLoading?: boolean;
  completedError?: string | null;
  onRequestCompleted?: () => void;
}

export default function ChallengeListSections({
  challenges,
  completedChallenges = null,
  completedCount = 0,
  completedLoading = false,
  completedError = null,
  onRequestCompleted,
}: ChallengeListSectionsProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Record<ChallengeStatus, boolean>>({
    ACTIVE: false,
    PENDING: false,
    COMPLETED: false,
  });

  const sectionLabels: Record<ChallengeStatus, string> = {
    PENDING: t("status.pending"),
    ACTIVE: t("status.active"),
    COMPLETED: t("status.completed"),
  };

  const liveByStatus: Record<"ACTIVE" | "PENDING", ChallengeDTO[]> = {
    ACTIVE: challenges.filter((c) => c.status === "ACTIVE"),
    PENDING: challenges.filter((c) => c.status === "PENDING"),
  };
  const completedItems = completedChallenges ?? [];
  const completedTotal = completedChallenges?.length ?? completedCount;

  const sections = SECTION_ORDER.filter((status) => {
    if (status === "COMPLETED") {
      return completedTotal > 0 || completedLoading || Boolean(completedError);
    }
    return liveByStatus[status].length > 0;
  });

  function toggle(status: ChallengeStatus) {
    const willOpen = !expanded[status];
    if (status === "COMPLETED" && willOpen) onRequestCompleted?.();
    setExpanded((prev) => ({ ...prev, [status]: !prev[status] }));
  }

  return (
    <div className="space-y-2">
      {sections.map((status) => {
        const isOpen = expanded[status];
        const count = status === "COMPLETED" ? completedTotal : liveByStatus[status].length;
        return (
          <section key={status} className="tet-card overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(status)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-amber-50/50 dark:hover:bg-gray-900/50"
            >
              <span className="flex items-center gap-2 font-medium text-gray-900 dark:text-gray-100">
                {isOpen ? (
                  <ChevronDown size={16} className="shrink-0 text-gray-500" />
                ) : (
                  <ChevronRight size={16} className="shrink-0 text-gray-500" />
                )}
                {sectionLabels[status]}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">{count}</span>
            </button>
            {isOpen && (
              <div className="border-t border-amber-100/60 px-4 py-3 dark:border-gray-800">
                {status === "COMPLETED" ? (
                  completedError ? (
                    <ErrorBanner message={completedError} onRetry={onRequestCompleted} />
                  ) : completedLoading && completedChallenges === null ? (
                    <div className="flex justify-center py-6">
                      <Loader2 size={20} className="animate-spin text-emerald-600" />
                      <span className="sr-only">{t("common.loading")}</span>
                    </div>
                  ) : (
                    <ChallengeDayGroups challenges={completedItems} />
                  )
                ) : (
                  <div className="space-y-3">
                    {liveByStatus[status].map((challenge) => (
                      <ChallengeCard key={challenge.id} challenge={challenge} />
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
