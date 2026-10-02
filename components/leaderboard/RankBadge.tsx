"use client";

import { Crown } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";

interface RankBadgeProps {
  rank: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  /**
   * `podium` — solid circle on avatar (mock: gold / silver / purple).
   * `list` — vertical metallic column with crown for top 3; plain # otherwise.
   */
  variant?: "podium" | "list";
}

const PODIUM: Record<
  1 | 2 | 3,
  { face: string; text: string; ring: string; glow: string; labelKey: "leaderboard.medalGold" | "leaderboard.medalSilver" | "leaderboard.medalBronze" }
> = {
  1: {
    face: "bg-gradient-to-b from-yellow-300 to-amber-500",
    text: "text-slate-950",
    ring: "ring-2 ring-amber-200/90",
    glow: "shadow-[0_0_12px_rgba(251,191,36,0.7)]",
    labelKey: "leaderboard.medalGold",
  },
  2: {
    face: "bg-gradient-to-b from-slate-100 to-slate-300",
    text: "text-slate-900",
    ring: "ring-2 ring-white/80",
    glow: "shadow-[0_0_10px_rgba(226,232,240,0.55)]",
    labelKey: "leaderboard.medalSilver",
  },
  3: {
    face: "bg-gradient-to-b from-fuchsia-200 to-violet-500",
    text: "text-white",
    ring: "ring-2 ring-fuchsia-200/80",
    glow: "shadow-[0_0_10px_rgba(232,121,249,0.55)]",
    labelKey: "leaderboard.medalBronze",
  },
};

const LIST: Record<
  1 | 2 | 3,
  { col: string; text: string; crown: string; labelKey: "leaderboard.medalGold" | "leaderboard.medalSilver" | "leaderboard.medalBronze" }
> = {
  1: {
    col: "bg-gradient-to-b from-yellow-300 via-amber-400 to-amber-700 shadow-[0_0_12px_rgba(251,191,36,0.55)]",
    text: "text-amber-950",
    crown: "text-amber-300",
    labelKey: "leaderboard.medalGold",
  },
  2: {
    col: "bg-gradient-to-b from-slate-100 via-slate-300 to-slate-500 shadow-[0_0_10px_rgba(203,213,225,0.45)]",
    text: "text-slate-900",
    crown: "text-slate-300",
    labelKey: "leaderboard.medalSilver",
  },
  3: {
    col: "bg-gradient-to-b from-orange-300 via-amber-700 to-orange-950 shadow-[0_0_10px_rgba(180,83,9,0.45)]",
    text: "text-orange-50",
    crown: "text-orange-300",
    labelKey: "leaderboard.medalBronze",
  },
};

const PODIUM_SIZE = {
  sm: "h-6 w-6 text-[11px]",
  md: "h-7 w-7 text-xs",
  lg: "h-8 w-8 text-sm",
};

/** Rank badge matching the mock: podium circle or list column. */
export default function RankBadge({
  rank,
  className = "",
  size = "sm",
  variant = "list",
}: RankBadgeProps) {
  const { t } = useI18n();
  const top = rank >= 1 && rank <= 3 ? (rank as 1 | 2 | 3) : null;

  if (variant === "podium" && top) {
    const style = PODIUM[top];
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center rounded-full font-heading font-black tabular-nums ${PODIUM_SIZE[size]} ${style.face} ${style.text} ${style.ring} ${style.glow} ${className}`}
        title={t(style.labelKey)}
        aria-label={t(style.labelKey)}
      >
        {rank}
      </span>
    );
  }

  if (variant === "list" && top) {
    const style = LIST[top];
    return (
      <span
        className={`relative inline-flex h-9 w-7 shrink-0 flex-col items-center justify-end ${className}`}
        title={t(style.labelKey)}
        aria-label={t(style.labelKey)}
      >
        <Crown
          size={11}
          className={`absolute -top-0.5 left-1/2 z-10 -translate-x-1/2 ${style.crown} drop-shadow-[0_0_5px_rgba(251,191,36,0.55)]`}
          aria-hidden
        />
        <span
          className={`flex h-7 w-6 items-center justify-center rounded-md font-heading text-xs font-black tabular-nums ring-1 ring-white/25 ${style.col} ${style.text}`}
        >
          {rank}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex h-7 w-6 items-center justify-center font-heading text-sm font-bold tabular-nums text-slate-500 dark:text-slate-200 ${className}`}
      aria-label={t("leaderboard.rankLabel", { rank })}
    >
      {rank}
    </span>
  );
}
