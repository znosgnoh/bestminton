"use client";

import type { ChallengeStatus } from "@/lib/types";
import { useI18n } from "@/contexts/LocaleContext";

interface StatusBadgeProps {
  status: ChallengeStatus;
}

const STYLES: Record<ChallengeStatus, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  ACTIVE: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300",
  COMPLETED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const { t } = useI18n();
  const labels: Record<ChallengeStatus, string> = {
    PENDING: t("status.pending"),
    ACTIVE: t("status.active"),
    COMPLETED: t("status.completed"),
  };

  return (
    <span className={`inline-flex shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${STYLES[status]}`}>
      {labels[status]}
    </span>
  );
}
