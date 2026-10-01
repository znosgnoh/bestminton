"use client";

import Link from "next/link";
import { Flame } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import BadmintonRacketIcon from "@/components/ui/BadmintonRacketIcon";
import RankBadge from "@/components/leaderboard/RankBadge";
import StreakBadge from "@/components/ui/StreakBadge";
import { useI18n } from "@/contexts/LocaleContext";
import { podiumEntries } from "@/lib/leaderboardHighlights";
import { streakKind } from "@/lib/streakUi";
import type { LeaderboardEntryDTO } from "@/lib/types";

interface LeaderboardPodiumProps {
  entries: LeaderboardEntryDTO[];
}

const PLACE_ORDER = [2, 1, 3] as const;

const PLACE_STYLE: Record<
  1 | 2 | 3,
  {
    step: string;
    stepH: string;
    ring: string;
    glow: string;
    name: string;
    elo: string;
    avatar: "md" | "lg";
  }
> = {
  1: {
    step: "bg-gradient-to-t from-orange-700 via-amber-500 to-yellow-300",
    stepH: "h-16 sm:h-20",
    ring: "ring-orange-300/90 leaderboard-champ-ring",
    glow: "from-orange-400/55 via-amber-500/15 to-transparent",
    name: "text-white",
    elo: "text-amber-200/90",
    avatar: "lg",
  },
  2: {
    step: "bg-gradient-to-t from-slate-700 via-slate-400 to-slate-200",
    stepH: "h-11 sm:h-14",
    ring: "ring-slate-300/80",
    glow: "from-slate-300/35 via-transparent to-transparent",
    name: "text-slate-100",
    elo: "text-slate-300",
    avatar: "md",
  },
  3: {
    step: "bg-gradient-to-t from-violet-950 via-fuchsia-700 to-rose-400",
    stepH: "h-8 sm:h-10",
    ring: "ring-fuchsia-400/60",
    glow: "from-fuchsia-400/30 via-transparent to-transparent",
    name: "text-slate-100",
    elo: "text-fuchsia-200/80",
    avatar: "md",
  },
};

export default function LeaderboardPodium({ entries }: LeaderboardPodiumProps) {
  const { t } = useI18n();
  const top = podiumEntries(entries);
  if (top.length === 0) return null;

  const byRank = new Map(top.map((e) => [e.rank, e]));

  return (
    <section
      className="leaderboard-podium relative overflow-hidden rounded-2xl ring-1 ring-orange-400/30"
      aria-label={t("leaderboard.podiumTitle")}
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-10%,rgba(251,146,60,0.35),transparent_55%),radial-gradient(circle_at_8%_100%,rgba(234,88,12,0.22),transparent_42%),radial-gradient(circle_at_92%_80%,rgba(56,189,248,0.12),transparent_40%),linear-gradient(165deg,#0a0604_0%,#1a0f0a_45%,#0f172a_100%)]"
        aria-hidden
      />
      {/* Court lane lines */}
      <div
        className="pointer-events-none absolute inset-x-6 bottom-0 top-10 opacity-30 [background-image:linear-gradient(90deg,transparent_0%,transparent_48%,rgba(255,255,255,0.12)_49%,rgba(255,255,255,0.12)_51%,transparent_52%,transparent_100%),linear-gradient(180deg,transparent_0%,transparent_72%,rgba(251,146,60,0.25)_72%,rgba(251,146,60,0.25)_73%,transparent_73%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.35] [background-image:linear-gradient(rgba(251,146,60,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(251,146,60,0.07)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_75%_80%_at_50%_35%,#000_15%,transparent_75%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-10 left-1/2 h-36 w-64 -translate-x-1/2 rounded-full bg-orange-500/25 blur-3xl podium-fire-glow"
        aria-hidden
      />

      {/* Floating racket + shuttle accents */}
      <BadmintonRacketIcon
        size={28}
        className="podium-racket-float pointer-events-none absolute left-3 top-4 text-orange-300/40"
      />
      <BadmintonRacketIcon
        size={24}
        className="podium-racket-float-delay pointer-events-none absolute right-3 top-8 -scale-x-100 text-cyan-300/30"
      />
      <span className="podium-shuttle pointer-events-none absolute left-[18%] top-12 h-2 w-2 rounded-full bg-white/80 shadow-[0_0_8px_rgba(255,255,255,0.7)]" />
      <span className="podium-shuttle-delay pointer-events-none absolute right-[22%] top-16 h-1.5 w-1.5 rounded-full bg-orange-200/90 shadow-[0_0_8px_rgba(251,146,60,0.8)]" />

      <div className="relative px-3 pt-4 pb-3 sm:px-4 sm:pt-5">
        <div className="mb-5 flex items-center justify-center gap-2">
          <Flame size={15} className="streak-flame-core text-orange-400" aria-hidden />
          <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-orange-100/90">
            {t("leaderboard.podiumTitle")}
          </h2>
          <BadmintonRacketIcon size={15} className="text-orange-300/80" />
        </div>

        <ol className="flex items-end justify-center gap-2 sm:gap-4">
          {PLACE_ORDER.map((place, index) => {
            const entry = byRank.get(place);
            if (!entry) {
              return <li key={place} className="w-[30%] max-w-[7.5rem]" aria-hidden />;
            }
            const style = PLACE_STYLE[place];
            const hot = streakKind(entry.singlesWinStreak, entry.singlesLoseStreak);
            return (
              <li
                key={entry.id}
                className="leaderboard-podium-place w-[30%] max-w-[7.5rem]"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <Link
                  href={`/members/${entry.id}`}
                  className="group flex cursor-pointer flex-col items-center rounded-xl text-center outline-none focus-visible:ring-2 focus-visible:ring-orange-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  <div className="relative mb-2">
                    {place === 1 && (
                      <Flame
                        size={18}
                        className="streak-flame-core absolute -top-5 left-1/2 z-10 -translate-x-1/2 text-orange-400 drop-shadow-[0_0_10px_rgba(251,146,60,0.9)]"
                        aria-hidden
                      />
                    )}
                    {(hot === "fire" || hot === "inferno") && place !== 1 && (
                      <Flame
                        size={14}
                        className="streak-flame-core absolute -top-3.5 left-1/2 z-10 -translate-x-1/2 text-orange-400/90"
                        aria-hidden
                      />
                    )}
                    <div
                      className={`absolute -inset-3 rounded-full bg-gradient-to-b ${style.glow}`}
                      aria-hidden
                    />
                    {hot === "inferno" && (
                      <div className="podium-inferno-aura absolute -inset-4 rounded-full" aria-hidden />
                    )}
                    <div
                      className={`relative rounded-full ring-2 ${style.ring} transition-transform duration-200 group-hover:scale-[1.05]`}
                    >
                      <Avatar
                        name={entry.name}
                        avatarUrl={entry.avatarUrl}
                        size={style.avatar}
                      />
                    </div>
                    <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                      <RankBadge rank={place} size="md" />
                    </div>
                  </div>

                  <p
                    className={`mt-2 flex w-full items-center justify-center gap-1 truncate px-0.5 text-xs font-semibold sm:text-sm ${style.name}`}
                  >
                    <span className="truncate">{entry.name}</span>
                  </p>
                  <div className="mt-0.5 flex items-center justify-center gap-1">
                    <StreakBadge
                      winStreak={entry.singlesWinStreak}
                      loseStreak={entry.singlesLoseStreak}
                      size="sm"
                    />
                  </div>
                  <p className={`mt-0.5 text-[11px] font-medium tabular-nums ${style.elo}`}>
                    {t("leaderboard.eloValue", { elo: entry.eloRating })}
                  </p>

                  <div
                    className={`mt-2 flex w-full items-end justify-center rounded-t-md ${style.step} ${style.stepH} shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]`}
                    aria-hidden
                  >
                    <span className="pb-1.5 font-heading text-lg font-bold text-white/95 drop-shadow sm:text-xl">
                      {place}
                    </span>
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
