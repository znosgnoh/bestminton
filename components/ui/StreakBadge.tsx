"use client";

import { Flame, Snowflake } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";
import { streakCount, streakKind } from "@/lib/streakUi";

interface StreakBadgeProps {
  winStreak: number;
  loseStreak: number;
  className?: string;
  /** Show ×N count next to the icon (default true). */
  showCount?: boolean;
  size?: "sm" | "md";
}

const SIZE = {
  sm: { icon: 14, text: "text-[10px]", pad: "gap-0.5 px-1 py-0.5" },
  md: { icon: 18, text: "text-xs", pad: "gap-1 px-1.5 py-1" },
};

/** Fire / inferno / ice streak pill with flicker animation. */
export default function StreakBadge({
  winStreak,
  loseStreak,
  className = "",
  showCount = true,
  size = "sm",
}: StreakBadgeProps) {
  const { t } = useI18n();
  const kind = streakKind(winStreak, loseStreak);
  if (!kind) return null;

  const count = streakCount(winStreak, loseStreak);
  const s = SIZE[size];

  if (kind === "inferno") {
    return (
      <span
        className={`streak-badge-inferno inline-flex items-center rounded-full font-bold tabular-nums text-orange-50 ring-1 ring-orange-300/50 ${s.pad} ${s.text} ${className}`}
        title={t("streak.inferno", { count })}
        aria-label={t("streak.inferno", { count })}
      >
        <Flame size={s.icon} className="streak-flame-core shrink-0" aria-hidden />
        <Flame
          size={Math.max(10, s.icon - 4)}
          className="streak-flame-ember -ml-1.5 shrink-0 text-yellow-300"
          aria-hidden
        />
        {showCount && <span>×{count}</span>}
      </span>
    );
  }

  if (kind === "fire") {
    return (
      <span
        className={`streak-badge-fire inline-flex items-center rounded-full font-semibold tabular-nums text-orange-500 dark:text-orange-300 ${s.pad} ${s.text} ${className}`}
        title={t("streak.fire", { count })}
        aria-label={t("streak.fire", { count })}
      >
        <Flame size={s.icon} className="streak-flame-core shrink-0" aria-hidden />
        {showCount && <span>×{count}</span>}
      </span>
    );
  }

  return (
    <span
      className={`streak-badge-ice inline-flex items-center rounded-full font-semibold tabular-nums text-sky-500 dark:text-sky-300 ${s.pad} ${s.text} ${className}`}
      title={t("streak.ice", { count })}
      aria-label={t("streak.ice", { count })}
    >
      <Snowflake size={s.icon} className="streak-ice-spin shrink-0" aria-hidden />
      {showCount && <span>×{count}</span>}
    </span>
  );
}
