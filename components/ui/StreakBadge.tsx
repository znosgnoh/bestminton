"use client";

import { Flame, Snowflake } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";
import { STREAK_ACTIVE_THRESHOLD } from "@/lib/elo";

interface StreakBadgeProps {
  winStreak: number;
  loseStreak: number;
  className?: string;
  /** Show ×N count next to the icon (default true). */
  showCount?: boolean;
}

export default function StreakBadge({
  winStreak,
  loseStreak,
  className = "",
  showCount = true,
}: StreakBadgeProps) {
  const { t } = useI18n();

  if (winStreak >= STREAK_ACTIVE_THRESHOLD) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-orange-500 dark:text-orange-400 ${className}`}
        title={t("streak.fire", { count: winStreak })}
        aria-label={t("streak.fire", { count: winStreak })}
      >
        <Flame size={14} className="shrink-0" aria-hidden />
        {showCount && <span className="text-[10px] font-semibold tabular-nums">×{winStreak}</span>}
      </span>
    );
  }

  if (loseStreak >= STREAK_ACTIVE_THRESHOLD) {
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-sky-500 dark:text-sky-400 ${className}`}
        title={t("streak.ice", { count: loseStreak })}
        aria-label={t("streak.ice", { count: loseStreak })}
      >
        <Snowflake size={14} className="shrink-0" aria-hidden />
        {showCount && <span className="text-[10px] font-semibold tabular-nums">×{loseStreak}</span>}
      </span>
    );
  }

  return null;
}
