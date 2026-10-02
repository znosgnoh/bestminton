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
    stepFace: string;
    stepSide: string;
    stepH: string;
    ring: string;
    glow: string;
    name: string;
    elo: string;
    crown: string;
    number: string;
    avatar: "md" | "lg";
  }
> = {
  1: {
    stepFace:
      "bg-gradient-to-b from-yellow-200 via-amber-400 to-amber-800 shadow-[0_0_32px_rgba(251,191,36,0.55)]",
    stepSide: "bg-gradient-to-b from-amber-500 to-amber-950",
    stepH: "h-[5.25rem] sm:h-28",
    ring: "ring-amber-300 leaderboard-champ-ring",
    glow: "from-amber-300/70 via-orange-500/25 to-transparent",
    name: "text-white",
    elo: "text-amber-200",
    crown: "text-amber-300",
    number: "text-amber-950/80",
    avatar: "lg",
  },
  2: {
    stepFace:
      "bg-gradient-to-b from-cyan-100 via-sky-400 to-blue-800 shadow-[0_0_26px_rgba(34,211,238,0.45)]",
    stepSide: "bg-gradient-to-b from-sky-500 to-blue-950",
    stepH: "h-[3.75rem] sm:h-[4.75rem]",
    ring: "ring-cyan-300/95",
    glow: "from-cyan-300/50 via-transparent to-transparent",
    name: "text-slate-50",
    elo: "text-cyan-200",
    crown: "text-cyan-200",
    number: "text-blue-950/75",
    avatar: "md",
  },
  3: {
    stepFace:
      "bg-gradient-to-b from-fuchsia-200 via-fuchsia-500 to-violet-900 shadow-[0_0_26px_rgba(232,121,249,0.45)]",
    stepSide: "bg-gradient-to-b from-fuchsia-600 to-violet-950",
    stepH: "h-12 sm:h-16",
    ring: "ring-fuchsia-300/90",
    glow: "from-fuchsia-400/45 via-transparent to-transparent",
    name: "text-slate-50",
    elo: "text-fuchsia-200",
    crown: "text-fuchsia-300",
    number: "text-violet-950/70",
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
      className="leaderboard-podium relative overflow-hidden rounded-2xl ring-1 ring-amber-400/35"
      aria-label={t("leaderboard.podiumTitle")}
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_95%_75%_at_50%_-10%,rgba(251,191,36,0.42),transparent_55%),radial-gradient(circle_at_8%_100%,rgba(34,211,238,0.18),transparent_42%),radial-gradient(circle_at_92%_88%,rgba(232,121,249,0.18),transparent_42%),linear-gradient(165deg,#04060d_0%,#0b1220_50%,#111827_100%)]"
        aria-hidden
      />
      <div
        className="podium-beam pointer-events-none absolute left-1/2 top-0 h-full w-28 -translate-x-1/2 bg-gradient-to-b from-amber-200/30 via-amber-400/8 to-transparent blur-md"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-6 bottom-0 top-6 opacity-30 [background-image:linear-gradient(90deg,transparent_0%,transparent_48%,rgba(255,255,255,0.2)_49%,rgba(255,255,255,0.2)_51%,transparent_52%),linear-gradient(180deg,transparent_0%,transparent_68%,rgba(251,191,36,0.4)_68%,rgba(251,191,36,0.4)_69.5%,transparent_69.5%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-10 left-1/2 h-44 w-80 -translate-x-1/2 rounded-full bg-amber-400/30 blur-3xl podium-fire-glow"
        aria-hidden
      />

      <BadmintonRacketIcon
        size={30}
        className="podium-racket-float pointer-events-none absolute left-2 top-5 text-amber-300/40"
      />
      <BadmintonRacketIcon
        size={26}
        className="podium-racket-float-delay pointer-events-none absolute right-2 top-8 -scale-x-100 text-cyan-300/35"
      />
      <span className="podium-shuttle pointer-events-none absolute left-[16%] top-14 h-2 w-2 rounded-full bg-white/90 shadow-[0_0_10px_rgba(255,255,255,0.85)]" />
      <span className="podium-shuttle-delay pointer-events-none absolute right-[18%] top-16 h-1.5 w-1.5 rounded-full bg-amber-200 shadow-[0_0_10px_rgba(251,191,36,0.95)]" />

      <div className="relative px-3 pt-4 pb-2 sm:px-4 sm:pt-5">
        <div className="mb-1 flex items-center justify-between gap-2 px-1">
          <div className="flex items-center gap-2">
            <Flame size={15} className="streak-flame-core text-amber-400" aria-hidden />
            <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-amber-100/90">
              {t("leaderboard.podiumTitle")}
            </h2>
          </div>
          <p className="tet-script text-sm text-amber-300/90">{t("leaderboard.podiumTagline")}</p>
        </div>

        <ol className="mt-5 flex items-end justify-center gap-1.5 sm:gap-3">
          {PLACE_ORDER.map((place, index) => {
            const entry = byRank.get(place);
            if (!entry) {
              return <li key={place} className="w-[31%] max-w-[8.25rem]" aria-hidden />;
            }
            const style = PLACE_STYLE[place];
            const hot = streakKind(entry.singlesWinStreak, entry.singlesLoseStreak);
            return (
              <li
                key={entry.id}
                className="leaderboard-podium-place w-[31%] max-w-[8.25rem]"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <Link
                  href={`/members/${entry.id}`}
                  className="group flex cursor-pointer flex-col items-center rounded-xl text-center outline-none focus-visible:ring-2 focus-visible:ring-amber-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  <div className="relative mb-1">
                    <Crown
                      size={place === 1 ? 22 : 16}
                      className={`absolute z-10 -translate-x-1/2 left-1/2 ${
                        place === 1 ? "-top-6" : "-top-5"
                      } ${style.crown} drop-shadow-[0_0_10px_rgba(251,191,36,0.75)]`}
                      aria-hidden
                    />
                    <div
                      className={`absolute -inset-3 rounded-full bg-gradient-to-b ${style.glow}`}
                      aria-hidden
                    />
                    {(hot === "inferno" || hot === "fire") && (
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
                    <div className="absolute -bottom-2 left-1/2 z-10 -translate-x-1/2">
                      <RankBadge rank={place} size={place === 1 ? "lg" : "md"} />
                    </div>
                  </div>

                  <p
                    className={`mt-3 w-full truncate px-0.5 text-xs font-bold sm:text-sm ${style.name}`}
                  >
                    {entry.name}
                  </p>

                  <div className="mt-1 flex items-center justify-center gap-1.5">
                    <p className={`text-[11px] font-semibold tabular-nums ${style.elo}`}>
                      {t("leaderboard.eloValue", { elo: entry.eloRating })}
                    </p>
                    <StreakBadge
                      winStreak={entry.singlesWinStreak}
                      loseStreak={entry.singlesLoseStreak}
                      size="sm"
                      mode="always"
                    />
                  </div>

                  {/* 3D pedestal */}
                  <div className={`relative mt-2 w-full ${style.stepH}`}>
                    <div
                      className={`absolute inset-x-0 bottom-0 top-2 ${style.stepSide} [clip-path:polygon(10%_0,90%_0,100%_100%,0_100%)] opacity-80`}
                      aria-hidden
                    />
                    <div
                      className={`absolute inset-0 flex items-center justify-center ${style.stepFace} [clip-path:polygon(12%_0,88%_0,100%_100%,0_100%)]`}
                      aria-hidden
                    >
                      <span
                        className={`font-heading text-4xl font-black leading-none tracking-tight sm:text-5xl ${style.number}`}
                        style={{ textShadow: "0 2px 0 rgba(255,255,255,0.25), 0 -1px 0 rgba(0,0,0,0.35)" }}
                      >
                        {place}
                      </span>
                    </div>
                    {/* Top rim highlight */}
                    <div
                      className="absolute inset-x-[12%] top-0 h-1 rounded-full bg-white/40 blur-[0.5px]"
                      aria-hidden
                    />
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
