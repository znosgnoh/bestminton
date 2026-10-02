"use client";

import type { ReactNode } from "react";
import { Flame } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import BadmintonRacketIcon from "@/components/ui/BadmintonRacketIcon";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import RankBadge from "@/components/leaderboard/RankBadge";
import StreakBadge from "@/components/ui/StreakBadge";
import { useI18n } from "@/contexts/LocaleContext";
import { streakKind } from "@/lib/streakUi";
import type { MemberDTO } from "@/lib/types";

interface PlayerHeroBannerProps {
  member: MemberDTO;
  rank: number | null;
  emailSlot?: ReactNode;
  netCam: number;
  formatNetCam: (net: number) => string;
}

function heroCamClass(net: number): string {
  if (net > 0) return "text-green-300";
  if (net < 0) return "text-rose-300";
  return "text-slate-400";
}

function ringForRank(rank: number | null, hot: ReturnType<typeof streakKind>): string {
  if (rank === 1) return "ring-orange-300/90 leaderboard-champ-ring";
  if (rank === 2) return "ring-slate-300/80";
  if (rank === 3) return "ring-fuchsia-400/70";
  if (hot === "inferno") return "ring-orange-400/80 leaderboard-champ-ring";
  if (hot === "fire") return "ring-orange-400/50";
  return "ring-white/20";
}

/** Dark badminton/fire hero used on the member detail page. */
export default function PlayerHeroBanner({
  member,
  rank,
  emailSlot,
  netCam,
  formatNetCam,
}: PlayerHeroBannerProps) {
  const { t } = useI18n();
  const hot = streakKind(member.singlesWinStreak, member.singlesLoseStreak);
  const isElite = rank != null && rank >= 1 && rank <= 3;
  const isInferno = hot === "inferno";

  return (
    <section
      className="player-hero relative overflow-hidden rounded-2xl ring-1 ring-orange-400/25"
      aria-label={member.name}
    >
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_90%_80%_at_20%_-10%,rgba(251,191,36,0.32),transparent_50%),radial-gradient(circle_at_100%_100%,rgba(34,211,238,0.14),transparent_40%),radial-gradient(circle_at_90%_10%,rgba(232,121,249,0.12),transparent_35%),linear-gradient(145deg,#05070f_0%,#0b1220_55%,#111827_100%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(251,191,36,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(251,191,36,0.08)_1px,transparent_1px)] [background-size:18px_18px]"
        aria-hidden
      />
      {(isElite || isInferno) && (
        <div
          className="pointer-events-none absolute -top-8 right-0 h-32 w-40 rounded-full bg-amber-400/25 blur-3xl podium-fire-glow"
          aria-hidden
        />
      )}
      <BadmintonRacketIcon
        size={36}
        className="podium-racket-float pointer-events-none absolute -right-1 bottom-2 text-amber-300/25"
      />

      <div className="relative p-5">
        <div className="flex items-center gap-4">
          <div className="relative shrink-0">
            {(isElite || hot === "fire" || isInferno) && (
              <Flame
                size={isInferno || rank === 1 ? 18 : 14}
                className="streak-flame-core absolute -top-3 left-1/2 z-10 -translate-x-1/2 text-orange-400 drop-shadow-[0_0_8px_rgba(251,146,60,0.85)]"
                aria-hidden
              />
            )}
            {isInferno && (
              <div className="podium-inferno-aura absolute -inset-3 rounded-full" aria-hidden />
            )}
            <div className={`relative rounded-full ring-2 ${ringForRank(rank, hot)}`}>
              <Avatar name={member.name} avatarUrl={member.avatarUrl} size="lg" />
            </div>
            {rank != null && (
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2">
                <RankBadge
                  rank={rank}
                  size="lg"
                  variant={rank <= 3 ? "podium" : "list"}
                />
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            {(isElite || isInferno) && (
              <p className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-orange-200/80">
                <Flame size={11} className="streak-flame-core" aria-hidden />
                {isElite ? t("profile.eliteTag") : t("profile.infernoTag")}
              </p>
            )}
            <h1 className="flex min-w-0 items-center gap-2 font-heading text-2xl font-bold text-white">
              <span className="truncate">{member.name}</span>
              <StreakBadge
                winStreak={member.singlesWinStreak}
                loseStreak={member.singlesLoseStreak}
                className="shrink-0"
                size="md"
              />
            </h1>
            <p className="mt-1 text-sm text-slate-300">
              {rank != null && (
                <span>
                  {t("profile.rank", { rank })} ·{" "}
                </span>
              )}
              Elo {member.eloRating}
            </p>
            {emailSlot}
            <p
              className={`mt-1 inline-flex items-center gap-1 text-sm font-medium ${heroCamClass(netCam)}`}
            >
              <OrangeJuiceIcon size={14} />
              {formatNetCam(netCam)}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
