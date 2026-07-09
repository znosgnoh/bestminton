"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import ChallengeCard from "@/components/challenges/ChallengeCard";
import ChallengeDayGroups from "@/components/challenges/ChallengeDayGroups";
import { useI18n } from "@/contexts/LocaleContext";
import type { ChallengeDTO, ChallengeStatus } from "@/lib/types";

const SECTION_ORDER: ChallengeStatus[] = ["ACTIVE", "PENDING", "COMPLETED"];

interface ChallengeListSectionsProps {
  challenges: ChallengeDTO[];
}

export default function ChallengeListSections({ challenges }: ChallengeListSectionsProps) {
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

  const sections = SECTION_ORDER.map((status) => ({
    status,
    items: challenges.filter((c) => c.status === status),
  })).filter((section) => section.items.length > 0);

  function toggle(status: ChallengeStatus) {
    setExpanded((prev) => ({ ...prev, [status]: !prev[status] }));
  }

  return (
    <div className="space-y-2">
      {sections.map(({ status, items }) => {
        const isOpen = expanded[status];
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
              <span className="text-xs text-gray-500 dark:text-gray-400">{items.length}</span>
            </button>
            {isOpen && (
              <div className="border-t border-amber-100/60 px-4 py-3 dark:border-gray-800">
                {status === "COMPLETED" ? (
                  <ChallengeDayGroups challenges={items} />
                ) : (
                  <div className="space-y-3">
                    {items.map((challenge) => (
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
