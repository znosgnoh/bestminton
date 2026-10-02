"use client";

import Link from "next/link";
import { Crown } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import BadmintonRacketIcon from "@/components/ui/BadmintonRacketIcon";
import RankBadge from "@/components/leaderboard/RankBadge";
import StreakBadge from "@/components/ui/StreakBadge";
import { useI18n } from "@/contexts/LocaleContext";
import { podiumEntries } from "@/lib/leaderboardHighlights";
import { streakKind } from "@/lib/streakUi";
import type { LeaderboardEntryDTO } from "@/lib/types";
// Crown still used in section header

interface LeaderboardPodiumProps {
  entries: LeaderboardEntryDTO[];
}

const PLACE_ORDER = [2, 1, 3] as const;

const PLACE_STYLE: Record<
  1 | 2 | 3,
  {
    stepFace: string;
    stepTop: string;
    stepH: string;
    ring: string;
    glow: string;
    name: string;
    elo: string;
    crown: string;
    number: string;
    avatar: "md" | "lg";
    platform: string;
  }
> = {
  1: {
    stepFace:
      "bg-[linear-gradient(180deg,#fde68a_0%,#f59e0b_35%,#b45309_78%,#78350f_100%)] shadow-[0_0_36px_rgba(251,191,36,0.55)]",
    stepTop: "bg-gradient-to-b from-yellow-200 to-amber-500",
    stepH: "h-[5.5rem] sm:h-[7rem]",
    ring: "ring-amber-300 leaderboard-champ-ring",
    glow: "from-amber-300/75 via-orange-500/20 to-transparent",
    name: "text-white",
    elo: "text-amber-200",
    crown: "text-amber-300",
    number: "text-amber-950/55",
    avatar: "lg",
    platform:
      "bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-700 shadow-[0_0_18px_rgba(251,191,36,0.55)] ring-2 ring-amber-200/70",
  },
  2: {
    stepFace:
      "bg-[linear-gradient(180deg,#93c5fd_0%,#3b82f6_28%,#1e3a8a_72%,#0f172a_100%)] shadow-[0_0_28px_rgba(59,130,246,0.4)]",
    stepTop: "bg-gradient-to-b from-slate-200 to-slate-400",
    stepH: "h-16 sm:h-[5.25rem]",
    ring: "ring-slate-200/90",
    glow: "from-slate-200/45 via-blue-500/15 to-transparent",
    name: "text-slate-50",
    elo: "text-slate-300",
    crown: "text-slate-200",
    number: "text-white/35",
    avatar: "md",
    platform:
      "bg-gradient-to-b from-slate-100 via-slate-300 to-slate-500 shadow-[0_0_14px_rgba(203,213,225,0.45)] ring-2 ring-white/50",
  },
  3: {
    stepFace:
      "bg-[linear-gradient(180deg,#e9d5ff_0%,#a855f7_30%,#6b21a8_72%,#3b0764_100%)] shadow-[0_0_28px_rgba(168,85,247,0.4)]",
    stepTop: "bg-gradient-to-b from-fuchsia-200 to-violet-500",
    stepH: "h-[3.25rem] sm:h-[4.25rem]",
    ring: "ring-fuchsia-300/85",
    glow: "from-fuchsia-400/45 via-transparent to-transparent",
    name: "text-slate-50",
    elo: "text-fuchsia-200",
    crown: "text-fuchsia-300",
    number: "text-white/35",
    avatar: "md",
    platform:
      "bg-gradient-to-b from-fuchsia-200 via-fuchsia-500 to-violet-700 shadow-[0_0_14px_rgba(232,121,249,0.45)] ring-2 ring-fuchsia-200/60",
  },
};

export default function LeaderboardPodium({ entries }: LeaderboardPodiumProps) {
  const { t } = useI18n();
  const top = podiumEntries(entries);
  if (top.length === 0) return null;

  const byRank = new Map(top.map((e) => [e.rank, e]));

  return (
    <section
      className="leaderboard-podium relative overflow-hidden rounded-2xl ring-1 ring-amber-400/35"
      aria-label={t("leaderboard.podiumTitle")}
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_95%_75%_at_50%_-10%,rgba(251,191,36,0.4),transparent_55%),radial-gradient(circle_at_8%_100%,rgba(59,130,246,0.16),transparent_42%),radial-gradient(circle_at_92%_88%,rgba(168,85,247,0.16),transparent_42%),linear-gradient(165deg,#04060d_0%,#0b1220_50%,#111827_100%)]"
        aria-hidden
      />
      <div
        className="podium-beam pointer-events-none absolute left-1/2 top-0 h-full w-28 -translate-x-1/2 bg-gradient-to-b from-amber-200/30 via-amber-400/8 to-transparent blur-md"
        aria-hidden
      />
      {/* Court lines */}
      <div
        className="pointer-events-none absolute inset-x-4 bottom-0 top-8 opacity-35 [background-image:linear-gradient(90deg,transparent_0%,transparent_48.5%,rgba(255,255,255,0.22)_49%,rgba(255,255,255,0.22)_51%,transparent_51.5%),linear-gradient(180deg,transparent_0%,transparent_66%,rgba(251,191,36,0.45)_66%,rgba(251,191,36,0.45)_67.5%,transparent_67.5%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-10 left-1/2 h-44 w-80 -translate-x-1/2 rounded-full bg-amber-400/28 blur-3xl podium-fire-glow"
        aria-hidden
      />

      <BadmintonRacketIcon
        size={28}
        className="podium-racket-float pointer-events-none absolute left-2 top-5 text-amber-300/35"
      />
      <BadmintonRacketIcon
        size={24}
        className="podium-racket-float-delay pointer-events-none absolute right-2 top-8 -scale-x-100 text-blue-300/30"
      />
      <span className="podium-shuttle pointer-events-none absolute left-[16%] top-14 h-2 w-2 rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.85)]" />
      <span className="podium-shuttle-delay pointer-events-none absolute right-[18%] top-16 h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.95)]" />

      <div className="relative px-2 pt-4 pb-2 sm:px-4 sm:pt-5">
        <div className="mb-1 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-1.5">
            <Crown size={13} className="text-amber-300" aria-hidden />
            <h2 className="font-heading text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-100/90">
              {t("leaderboard.podiumTitle")}
            </h2>
          </div>
          <p className="tet-script text-sm text-white/85">{t("leaderboard.podiumTagline")}</p>
        </div>

        <ol className="mt-6 flex items-end justify-center gap-1 sm:gap-2.5">
          {PLACE_ORDER.map((place, index) => {
            const entry = byRank.get(place);
            if (!entry) {
              return <li key={place} className="w-[32%] max-w-[8.5rem]" aria-hidden />;
            }
            const style = PLACE_STYLE[place];
            const hot = streakKind(entry.singlesWinStreak, entry.singlesLoseStreak);
            return (
              <li
                key={entry.id}
                className="leaderboard-podium-place w-[32%] max-w-[8.5rem]"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <Link
                  href={`/members/${entry.id}`}
                  className="group flex cursor-pointer flex-col items-center rounded-xl text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  {/* Avatar + crown badge + platform */}
                  <div className="relative z-10 mb-0">
                    <div
                      className={`absolute z-20 -translate-x-1/2 left-1/2 ${
                        place === 1 ? "-top-7" : "-top-5"
                      }`}
                    >
                      <RankBadge rank={place} size={place === 1 ? "lg" : "md"} variant="podium" />
                    </div>
                    <div
                      className={`absolute -inset-3 rounded-full bg-gradient-to-b ${style.glow}`}
                      aria-hidden
                    />
                    {hot === "inferno" && (
                      <div className="podium-inferno-aura absolute -inset-4 rounded-full" aria-hidden />
                    )}
                    <div
                      className={`relative rounded-full ring-[3px] ${style.ring} transition-transform duration-200 group-hover:scale-[1.04]`}
                    >
                      <Avatar
                        name={entry.name}
                        avatarUrl={entry.avatarUrl}
                        size={style.avatar}
                      />
                    </div>
                  </div>

                  {/* Circular stage platform under avatar */}
                  <div
                    className={`relative z-[5] -mt-1 h-3 w-[4.25rem] rounded-[100%] sm:w-[4.75rem] ${style.platform}`}
                    aria-hidden
                  />

                  <p
                    className={`mt-2 w-full truncate px-0.5 text-xs font-bold sm:text-sm ${style.name}`}
                  >
                    {entry.name}
                  </p>
                  <p className={`mt-0.5 text-[11px] font-semibold tabular-nums ${style.elo}`}>
                    {t("leaderboard.eloValue", { elo: entry.eloRating })}
                  </p>
                  <div className="mt-0.5 flex min-h-[1.15rem] items-center justify-center">
                    <StreakBadge
                      winStreak={entry.singlesWinStreak}
                      loseStreak={entry.singlesLoseStreak}
                      size="sm"
                    />
                  </div>

                  {/* Embossed pedestal block */}
                  <div className={`relative mt-1.5 w-full ${style.stepH}`}>
                    <div
                      className={`absolute inset-0 ${style.stepFace} [clip-path:polygon(8%_0,92%_0,100%_14%,100%_100%,0_100%,0_14%)]`}
                      aria-hidden
                    />
                    {/* Top bevel */}
                    <div
                      className={`absolute inset-x-[8%] top-0 h-[14%] ${style.stepTop} opacity-90 [clip-path:polygon(0_100%,8%_0,92%_0,100%_100%)]`}
                      aria-hidden
                    />
                    <div className="absolute inset-0 flex items-center justify-center pt-2">
                      <span
                        className={`select-none font-heading text-5xl font-black leading-none tracking-tight sm:text-6xl ${style.number}`}
                        style={{
                          WebkitTextStroke: "1px rgba(255,255,255,0.12)",
                          textShadow:
                            "0 3px 0 rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.2)",
                        }}
                        aria-hidden
                      >
                        {place}
                      </span>
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
