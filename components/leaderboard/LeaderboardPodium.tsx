"use client";

import Link from "next/link";
import { Crown, Flame } from "lucide-react";
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
    crown: string;
    avatar: "md" | "lg";
  }
> = {
  1: {
    step: "bg-gradient-to-b from-yellow-300 via-amber-500 to-amber-800 shadow-[0_0_28px_rgba(251,191,36,0.45)]",
    stepH: "h-[4.5rem] sm:h-24",
    ring: "ring-amber-300 leaderboard-champ-ring",
    glow: "from-amber-300/60 via-orange-500/20 to-transparent",
    name: "text-white",
    elo: "text-amber-200",
    crown: "text-amber-300",
    avatar: "lg",
  },
  2: {
    step: "bg-gradient-to-b from-cyan-200 via-sky-500 to-blue-800 shadow-[0_0_22px_rgba(34,211,238,0.35)]",
    stepH: "h-14 sm:h-[4.25rem]",
    ring: "ring-cyan-300/90",
    glow: "from-cyan-300/45 via-transparent to-transparent",
    name: "text-slate-50",
    elo: "text-cyan-200",
    crown: "text-cyan-200",
    avatar: "md",
  },
  3: {
    step: "bg-gradient-to-b from-fuchsia-300 via-fuchsia-600 to-violet-900 shadow-[0_0_22px_rgba(232,121,249,0.35)]",
    stepH: "h-11 sm:h-14",
    ring: "ring-fuchsia-300/80",
    glow: "from-fuchsia-400/40 via-transparent to-transparent",
    name: "text-slate-50",
    elo: "text-fuchsia-200",
    crown: "text-fuchsia-300",
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
      className="leaderboard-podium relative overflow-hidden rounded-2xl ring-1 ring-amber-400/30"
      aria-label={t("leaderboard.podiumTitle")}
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-8%,rgba(251,191,36,0.38),transparent_55%),radial-gradient(circle_at_10%_100%,rgba(34,211,238,0.16),transparent_40%),radial-gradient(circle_at_90%_85%,rgba(232,121,249,0.16),transparent_40%),linear-gradient(165deg,#05070f_0%,#0b1220_48%,#101828_100%)]"
        aria-hidden
      />
      {/* Stadium beams */}
      <div
        className="podium-beam pointer-events-none absolute left-1/2 top-0 h-full w-24 -translate-x-1/2 bg-gradient-to-b from-amber-200/25 via-amber-400/5 to-transparent blur-md"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-8 bottom-0 top-8 opacity-25 [background-image:linear-gradient(90deg,transparent_0%,transparent_48%,rgba(255,255,255,0.18)_49%,rgba(255,255,255,0.18)_51%,transparent_52%),linear-gradient(180deg,transparent_0%,transparent_70%,rgba(251,191,36,0.35)_70%,rgba(251,191,36,0.35)_71%,transparent_71%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(251,191,36,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(251,191,36,0.07)_1px,transparent_1px)] [background-size:20px_20px] [mask-image:radial-gradient(ellipse_75%_80%_at_50%_40%,#000_20%,transparent_75%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-10 left-1/2 h-40 w-72 -translate-x-1/2 rounded-full bg-amber-400/25 blur-3xl podium-fire-glow"
        aria-hidden
      />

      <BadmintonRacketIcon
        size={30}
        className="podium-racket-float pointer-events-none absolute left-2 top-5 text-amber-300/35"
      />
      <BadmintonRacketIcon
        size={26}
        className="podium-racket-float-delay pointer-events-none absolute right-2 top-8 -scale-x-100 text-cyan-300/30"
      />
      <span className="podium-shuttle pointer-events-none absolute left-[16%] top-14 h-2 w-2 rounded-full bg-white/85 shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
      <span className="podium-shuttle-delay pointer-events-none absolute right-[18%] top-16 h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.9)]" />

      <div className="relative px-3 pt-4 pb-3 sm:px-4 sm:pt-5">
        <div className="mb-1 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <Flame size={15} className="streak-flame-core text-amber-400" aria-hidden />
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/90">
              {t("leaderboard.podiumTitle")}
            </h2>
          </div>
          <p className="tet-script text-sm text-amber-300/90">
            {t("leaderboard.podiumTagline")}
          </p>
        </div>

        <ol className="mt-4 flex items-end justify-center gap-2 sm:gap-4">
          {PLACE_ORDER.map((place, index) => {
            const entry = byRank.get(place);
            if (!entry) {
              return <li key={place} className="w-[30%] max-w-[7.75rem]" aria-hidden />;
            }
            const style = PLACE_STYLE[place];
            const hot = streakKind(entry.singlesWinStreak, entry.singlesLoseStreak);
            return (
              <li
                key={entry.id}
                className="leaderboard-podium-place w-[30%] max-w-[7.75rem]"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <Link
                  href={`/members/${entry.id}`}
                  className="group flex cursor-pointer flex-col items-center rounded-xl text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  <div className="relative mb-2">
                    <Crown
                      size={place === 1 ? 20 : 15}
                      className={`absolute z-10 -translate-x-1/2 left-1/2 ${
                        place === 1 ? "-top-5" : "-top-4"
                      } ${style.crown} drop-shadow-[0_0_8px_rgba(251,191,36,0.65)]`}
                      aria-hidden
                    />
                    <div
                      className={`absolute -inset-3 rounded-full bg-gradient-to-b ${style.glow}`}
                      aria-hidden
                    />
                    {hot === "inferno" && (
                      <div className="podium-inferno-aura absolute -inset-4 rounded-full" aria-hidden />
                    )}
                    <div
                      className={`relative rounded-full ring-[3px] ${style.ring} transition-transform duration-200 group-hover:scale-[1.05]`}
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
                    className={`mt-2 w-full truncate px-0.5 text-xs font-semibold sm:text-sm ${style.name}`}
                  >
                    {entry.name}
                  </p>
                  <div className="mt-0.5 flex min-h-[1.1rem] items-center justify-center">
                    <StreakBadge
                      winStreak={entry.singlesWinStreak}
                      loseStreak={entry.singlesLoseStreak}
                      size="sm"
                    />
                  </div>
                  <p className={`mt-0.5 text-[11px] font-semibold tabular-nums ${style.elo}`}>
                    {t("leaderboard.eloValue", { elo: entry.eloRating })}
                  </p>

                  <div
                    className={`mt-2 flex w-full items-end justify-center rounded-t-md [clip-path:polygon(8%_0,92%_0,100%_100%,0_100%)] ${style.step} ${style.stepH}`}
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
