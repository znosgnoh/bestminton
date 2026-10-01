"use client";

import Link from "next/link";
import { Zap } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import RankBadge from "@/components/leaderboard/RankBadge";
import { useI18n } from "@/contexts/LocaleContext";
import { podiumEntries } from "@/lib/leaderboardHighlights";
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
    step: "bg-gradient-to-t from-cyan-700 via-sky-500 to-cyan-300",
    stepH: "h-16 sm:h-20",
    ring: "ring-cyan-300/90 leaderboard-champ-ring",
    glow: "from-cyan-400/50 via-sky-500/10 to-transparent",
    name: "text-white",
    elo: "text-cyan-200/90",
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
      className="leaderboard-podium relative overflow-hidden rounded-2xl ring-1 ring-cyan-400/25"
      aria-label={t("leaderboard.podiumTitle")}
    >
      {/* Cool arena backdrop — always dark, independent of page theme */}
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_70%_at_50%_-15%,rgba(34,211,238,0.28),transparent_55%),radial-gradient(circle_at_0%_100%,rgba(56,189,248,0.12),transparent_42%),radial-gradient(circle_at_100%_85%,rgba(217,70,239,0.14),transparent_40%),linear-gradient(165deg,#070b14_0%,#0f172a_48%,#111827_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.4] [background-image:linear-gradient(rgba(34,211,238,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(34,211,238,0.06)_1px,transparent_1px)] [background-size:22px_22px] [mask-image:radial-gradient(ellipse_70%_80%_at_50%_40%,#000_20%,transparent_75%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -top-16 left-1/2 h-40 w-56 -translate-x-1/2 rounded-full bg-cyan-400/20 blur-3xl"
        aria-hidden
      />

      <div className="relative px-3 pt-4 pb-3 sm:px-4 sm:pt-5">
        <div className="mb-5 flex items-center justify-center gap-2">
          <Zap size={15} className="text-cyan-300" aria-hidden />
          <h2 className="font-heading text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/90">
            {t("leaderboard.podiumTitle")}
          </h2>
        </div>

        <ol className="flex items-end justify-center gap-2 sm:gap-4">
          {PLACE_ORDER.map((place, index) => {
            const entry = byRank.get(place);
            if (!entry) {
              return <li key={place} className="w-[30%] max-w-[7.5rem]" aria-hidden />;
            }
            const style = PLACE_STYLE[place];
            return (
              <li
                key={entry.id}
                className="leaderboard-podium-place w-[30%] max-w-[7.5rem]"
                style={{ animationDelay: `${index * 90}ms` }}
              >
                <Link
                  href={`/members/${entry.id}`}
                  className="group flex cursor-pointer flex-col items-center rounded-xl text-center outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                >
                  <div className="relative mb-2">
                    {place === 1 && (
                      <Zap
                        size={16}
                        className="absolute -top-4 left-1/2 z-10 -translate-x-1/2 text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]"
                        aria-hidden
                      />
                    )}
                    <div
                      className={`absolute -inset-3 rounded-full bg-gradient-to-b ${style.glow}`}
                      aria-hidden
                    />
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
                    className={`mt-2 w-full truncate px-0.5 text-xs font-semibold sm:text-sm ${style.name}`}
                  >
                    {entry.name}
                  </p>
                  <p className={`text-[11px] font-medium tabular-nums ${style.elo}`}>
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
