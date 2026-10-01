"use client";

import { useI18n } from "@/contexts/LocaleContext";

interface RankBadgeProps {
  rank: number;
  className?: string;
  size?: "sm" | "md";
}

const MEDAL: Record<
  1 | 2 | 3,
  {
    ring: string;
    fill: string;
    text: string;
    labelKey: "leaderboard.medalGold" | "leaderboard.medalSilver" | "leaderboard.medalBronze";
  }
> = {
  1: {
    ring: "ring-orange-300/90",
    fill: "bg-gradient-to-br from-yellow-200 via-orange-400 to-red-600 shadow-[0_0_14px_rgba(249,115,22,0.65)]",
    text: "text-slate-950",
    labelKey: "leaderboard.medalGold",
  },
  2: {
    ring: "ring-slate-200/80",
    fill: "bg-gradient-to-br from-slate-100 via-slate-300 to-slate-500 shadow-[0_0_8px_rgba(148,163,184,0.45)]",
    text: "text-slate-900",
    labelKey: "leaderboard.medalSilver",
  },
  3: {
    ring: "ring-fuchsia-300/50",
    fill: "bg-gradient-to-br from-rose-300 via-fuchsia-500 to-violet-800 shadow-[0_0_8px_rgba(217,70,239,0.35)]",
    text: "text-white",
    labelKey: "leaderboard.medalBronze",
  },
};

const SIZE = {
  sm: "h-6 w-6 text-[11px]",
  md: "h-7 w-7 text-xs",
};

/** Champion / runner-up / third medals for ranks 1–3; plain number otherwise. */
export default function RankBadge({ rank, className = "", size = "sm" }: RankBadgeProps) {
  const { t } = useI18n();
  const medal = rank >= 1 && rank <= 3 ? MEDAL[rank as 1 | 2 | 3] : null;

  if (!medal) {
    return (
      <span
        className={`inline-flex items-center justify-center font-bold tabular-nums text-slate-400 ${SIZE[size]} ${className}`}
        aria-label={t("leaderboard.rankLabel", { rank })}
      >
        {rank}
      </span>
    );
  }

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold tabular-nums ring-2 ${medal.ring} ${medal.fill} ${medal.text} ${SIZE[size]} ${className}`}
      title={t(medal.labelKey)}
      aria-label={t(medal.labelKey)}
    >
      {rank}
    </span>
  );
}
