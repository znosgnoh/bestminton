"use client";

import { Crown } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";

interface RankBadgeProps {
  rank: number;
  className?: string;
  size?: "sm" | "md" | "lg";
  /** Show a small crown above top-3 medals. */
  showCrown?: boolean;
}

const MEDAL: Record<
  1 | 2 | 3,
  {
    labelKey: "leaderboard.medalGold" | "leaderboard.medalSilver" | "leaderboard.medalBronze";
    outer: string;
    mid: string;
    inner: string;
    text: string;
    crown: string;
    glow: string;
  }
> = {
  1: {
    labelKey: "leaderboard.medalGold",
    outer: "from-yellow-200 via-amber-400 to-amber-800",
    mid: "from-amber-100 via-yellow-300 to-amber-600",
    inner: "from-yellow-50 via-amber-300 to-amber-700",
    text: "text-amber-950",
    crown: "text-amber-300",
    glow: "shadow-[0_0_16px_rgba(251,191,36,0.75)]",
  },
  2: {
    labelKey: "leaderboard.medalSilver",
    outer: "from-cyan-100 via-sky-400 to-blue-800",
    mid: "from-white via-cyan-200 to-sky-600",
    inner: "from-cyan-50 via-sky-300 to-blue-700",
    text: "text-slate-950",
    crown: "text-cyan-300",
    glow: "shadow-[0_0_14px_rgba(34,211,238,0.65)]",
  },
  3: {
    labelKey: "leaderboard.medalBronze",
    outer: "from-fuchsia-200 via-fuchsia-500 to-violet-900",
    mid: "from-fuchsia-100 via-fuchsia-400 to-violet-700",
    inner: "from-fuchsia-50 via-fuchsia-400 to-violet-800",
    text: "text-white",
    crown: "text-fuchsia-300",
    glow: "shadow-[0_0_14px_rgba(232,121,249,0.6)]",
  },
};

const SIZE = {
  sm: { box: "h-7 w-7", text: "text-[11px]", crown: 10, inset: "inset-[2px]", mid: "inset-[3.5px]" },
  md: { box: "h-8 w-8", text: "text-xs", crown: 12, inset: "inset-[2.5px]", mid: "inset-[4px]" },
  lg: { box: "h-10 w-10", text: "text-sm", crown: 14, inset: "inset-[3px]", mid: "inset-[5px]" },
};

/** Layered metallic rank medal for 1–3; tinted chip for other ranks. */
export default function RankBadge({
  rank,
  className = "",
  size = "sm",
  showCrown = false,
}: RankBadgeProps) {
  const { t } = useI18n();
  const s = SIZE[size];
  const medal = rank >= 1 && rank <= 3 ? MEDAL[rank as 1 | 2 | 3] : null;

  if (!medal) {
    return (
      <span
        className={`inline-flex ${s.box} items-center justify-center rounded-full bg-slate-200/90 font-bold tabular-nums text-slate-600 ring-1 ring-slate-300/80 dark:bg-slate-800 dark:text-slate-200 dark:ring-slate-600 ${className}`}
        aria-label={t("leaderboard.rankLabel", { rank })}
      >
        <span className={s.text}>{rank}</span>
      </span>
    );
  }

  return (
    <span
      className={`relative inline-flex ${s.box} shrink-0 items-center justify-center ${className}`}
      title={t(medal.labelKey)}
      aria-label={t(medal.labelKey)}
    >
      {showCrown && (
        <Crown
          size={s.crown}
          className={`absolute -top-2.5 left-1/2 z-20 -translate-x-1/2 ${medal.crown} drop-shadow-[0_0_6px_rgba(251,191,36,0.7)]`}
          aria-hidden
        />
      )}
      {/* Outer metallic rim */}
      <span
        className={`absolute inset-0 rounded-full bg-gradient-to-br ${medal.outer} ${medal.glow}`}
        aria-hidden
      />
      {/* Mid ring highlight */}
      <span
        className={`absolute ${s.mid} rounded-full bg-gradient-to-br ${medal.mid}`}
        aria-hidden
      />
      {/* Inner face */}
      <span
        className={`absolute ${s.inset} rounded-full bg-gradient-to-b ${medal.inner} ring-1 ring-white/35`}
        aria-hidden
      />
      {/* Specular shine */}
      <span
        className="absolute inset-[18%] top-[12%] h-[28%] rounded-full bg-white/35 blur-[1px]"
        aria-hidden
      />
      <span className={`relative z-10 font-heading font-black tabular-nums ${medal.text} ${s.text}`}>
        {rank}
      </span>
    </span>
  );
}
