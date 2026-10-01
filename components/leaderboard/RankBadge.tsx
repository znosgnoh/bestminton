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
    ring: "ring-amber-300/90",
    fill: "bg-gradient-to-br from-yellow-200 via-amber-400 to-amber-700 shadow-[0_0_14px_rgba(251,191,36,0.7)]",
    text: "text-slate-950",
    labelKey: "leaderboard.medalGold",
  },
  2: {
    ring: "ring-cyan-300/90",
    fill: "bg-gradient-to-br from-cyan-100 via-sky-400 to-blue-700 shadow-[0_0_12px_rgba(34,211,238,0.55)]",
    text: "text-slate-950",
    labelKey: "leaderboard.medalSilver",
  },
  3: {
    ring: "ring-fuchsia-300/80",
    fill: "bg-gradient-to-br from-fuchsia-200 via-fuchsia-500 to-violet-800 shadow-[0_0_12px_rgba(232,121,249,0.5)]",
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
