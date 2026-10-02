"use client";

import { Crown } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";

interface RankBadgeProps {
  rank: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  /**
   * `podium` — glowing crown under avatar for top 3.
   * `list` — crown column for top 3; plain # otherwise.
   */
  variant?: "podium" | "list";
}

const TOP: Record<
  1 | 2 | 3,
  {
    crown: string;
    glow: string;
    labelKey: "leaderboard.medalGold" | "leaderboard.medalSilver" | "leaderboard.medalBronze";
  }
> = {
  1: {
    crown: "text-amber-300 fill-amber-400",
    glow: "drop-shadow-[0_0_10px_rgba(251,191,36,0.85)]",
    labelKey: "leaderboard.medalGold",
  },
  2: {
    crown: "text-slate-200 fill-slate-300",
    glow: "drop-shadow-[0_0_8px_rgba(226,232,240,0.7)]",
    labelKey: "leaderboard.medalSilver",
  },
  3: {
    crown: "text-fuchsia-300 fill-fuchsia-400",
    glow: "drop-shadow-[0_0_8px_rgba(232,121,249,0.7)]",
    labelKey: "leaderboard.medalBronze",
  },
};

const CROWN_SIZE = {
  sm: 18,
  md: 22,
  lg: 28,
};

const LIST_CROWN_SIZE = {
  sm: 20,
  md: 22,
  lg: 24,
};

/** Top-3 ranks show a colored crown; everyone else shows a plain rank number. */
export default function RankBadge({
  rank,
  className = "",
  size = "sm",
  variant = "list",
}: RankBadgeProps) {
  const { t } = useI18n();
  const top = rank >= 1 && rank <= 3 ? (rank as 1 | 2 | 3) : null;

  if (top) {
    const style = TOP[top];
    const px = variant === "podium" ? CROWN_SIZE[size] : LIST_CROWN_SIZE[size];
    return (
      <span
        className={`inline-flex shrink-0 items-center justify-center ${className}`}
        title={t(style.labelKey)}
        aria-label={t(style.labelKey)}
      >
        <Crown
          size={px}
          className={`${style.crown} ${style.glow}`}
          strokeWidth={1.75}
          aria-hidden
        />
        <span className="sr-only">{rank}</span>
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
