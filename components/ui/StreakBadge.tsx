"use client";

import { Flame, Snowflake, TrendingUp } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";
import { streakCount, streakKind } from "@/lib/streakUi";

interface StreakBadgeProps {
  winStreak: number;
  loseStreak: number;
  className?: string;
  /** Show count next to the icon (default true). */
  showCount?: boolean;
  size?: "sm" | "md";
  /**
   * `compact` — only active streaks (3+ fire / ice, 6+ inferno).
   * `always` — also show a warming flame for win streaks of 1–2 (podium / list / hero).
   */
  mode?: "compact" | "always";
}

const SIZE = {
  sm: { icon: 13, text: "text-[10px]", pad: "gap-0.5 px-1.5 py-0.5" },
  md: { icon: 16, text: "text-xs", pad: "gap-1 px-2 py-1" },
};

/** Fire / inferno / ice streak pill with flicker animation. */
export default function StreakBadge({
  winStreak,
  loseStreak,
  className = "",
  showCount = true,
  size = "sm",
  mode = "compact",
}: StreakBadgeProps) {
  const { t } = useI18n();
  const kind = streakKind(winStreak, loseStreak);
  const s = SIZE[size];

  if (!kind && mode === "always" && winStreak >= 1) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-orange-500/25 font-bold tabular-nums text-orange-200 ring-1 ring-orange-400/45 ${s.pad} ${s.text} ${className}`}
        title={t("streak.fire", { count: winStreak })}
        aria-label={t("streak.fire", { count: winStreak })}
      >
        <Flame size={s.icon} className="streak-flame-core shrink-0 text-orange-400" aria-hidden />
        {showCount && (
          <span className="inline-flex items-center gap-0.5">
            <TrendingUp size={Math.max(10, s.icon - 3)} className="text-green-400" aria-hidden />
            {winStreak}
          </span>
        )}
      </span>
    );
  }

  if (!kind && mode === "always" && loseStreak >= 1) {
    return (
      <span
        className={`inline-flex items-center rounded-full bg-sky-500/20 font-semibold tabular-nums text-sky-200 ring-1 ring-sky-400/40 ${s.pad} ${s.text} ${className}`}
        title={t("streak.ice", { count: loseStreak })}
        aria-label={t("streak.ice", { count: loseStreak })}
      >
        <Snowflake size={s.icon} className="streak-ice-spin shrink-0" aria-hidden />
        {showCount && <span>×{loseStreak}</span>}
      </span>
    );
  }

  if (!kind) return null;

  const count = streakCount(winStreak, loseStreak);

  if (kind === "inferno") {
    return (
      <span
        className={`streak-badge-inferno inline-flex items-center rounded-full font-bold tabular-nums text-orange-50 ring-1 ring-orange-300/60 ${s.pad} ${s.text} ${className}`}
        title={t("streak.inferno", { count })}
        aria-label={t("streak.inferno", { count })}
      >
        <Flame size={s.icon} className="streak-flame-core shrink-0" aria-hidden />
        <Flame
          size={Math.max(10, s.icon - 3)}
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
        className={`streak-badge-fire inline-flex items-center rounded-full bg-orange-500/30 font-bold tabular-nums text-orange-100 ring-1 ring-orange-400/55 ${s.pad} ${s.text} ${className}`}
        title={t("streak.fire", { count })}
        aria-label={t("streak.fire", { count })}
      >
        <Flame size={s.icon} className="streak-flame-core shrink-0 text-orange-400" aria-hidden />
        {showCount && (
          <span className="inline-flex items-center gap-0.5">
            <TrendingUp size={Math.max(10, s.icon - 3)} className="text-green-400" aria-hidden />
            {count}
          </span>
        )}
      </span>
    );
  }

  return (
    <span
      className={`streak-badge-ice inline-flex items-center rounded-full bg-sky-500/25 font-semibold tabular-nums text-sky-100 ring-1 ring-sky-400/45 ${s.pad} ${s.text} ${className}`}
      title={t("streak.ice", { count })}
      aria-label={t("streak.ice", { count })}
    >
      <Snowflake size={s.icon} className="streak-ice-spin shrink-0" aria-hidden />
      {showCount && <span>×{count}</span>}
    </span>
  );
}
