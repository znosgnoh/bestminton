"use client";

import Link from "next/link";
import { ChevronRight, Crown } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import RankBadge from "@/components/leaderboard/RankBadge";
import StreakBadge from "@/components/ui/StreakBadge";
import { useI18n } from "@/contexts/LocaleContext";
import type { LeaderboardEntryDTO } from "@/lib/types";

interface LeaderboardTableProps {
  entries: LeaderboardEntryDTO[];
}

function netCamClass(net: number): string {
  if (net > 0) return "text-green-600 dark:text-green-400";
  if (net < 0) return "text-red-600 dark:text-red-400";
  return "text-gray-600 dark:text-slate-400";
}

function formatNetCam(net: number): string {
  if (net === 0) return "0";
  const sign = net > 0 ? "+" : "-";
  return `${sign}${Math.abs(net)}`;
}

function rowHighlight(rank: number): string {
  if (rank === 1) {
    return "bg-amber-50/80 ring-1 ring-inset ring-amber-400/50 dark:bg-amber-500/10 dark:ring-amber-400/45 dark:shadow-[0_0_24px_rgba(251,191,36,0.12)]";
  }
  if (rank === 2) return "bg-cyan-50/50 dark:bg-cyan-500/5";
  if (rank === 3) return "bg-fuchsia-50/50 dark:bg-fuchsia-500/5";
  return "";
}

export default function LeaderboardTable({ entries }: LeaderboardTableProps) {
  const { t } = useI18n();

  if (entries.length === 0) {
    return (
      <div className="tet-empty">
        <p>{t("leaderboard.noMembers")}</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: compact card rows */}
      <div className="tet-card overflow-hidden md:hidden">
        <ul className="divide-y divide-slate-200/70 dark:divide-slate-800/80" aria-label="Leaderboard">
          {entries.map((entry) => {
            const losses = entry.totalMatches - entry.totalWins;
            const netCam = entry.debtSummary.netCam;

            return (
              <li key={entry.id} className={rowHighlight(entry.rank)}>
                <Link
                  href={`/members/${entry.id}`}
                  className="flex items-center gap-3 px-3 py-3 transition-colors hover:bg-amber-50/40 dark:hover:bg-white/5"
                >
                  <span className="relative flex w-7 shrink-0 items-center justify-center">
                    <RankBadge rank={entry.rank} />
                    {entry.rank <= 3 && (
                      <Crown
                        size={10}
                        className="absolute -top-1.5 text-amber-500 dark:text-amber-300"
                        aria-hidden
                      />
                    )}
                  </span>
                  <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-1.5 truncate font-medium text-gray-900 dark:text-slate-50">
                      <span className="truncate">{entry.name}</span>
                      <StreakBadge
                        winStreak={entry.singlesWinStreak}
                        loseStreak={entry.singlesLoseStreak}
                        className="shrink-0"
                      />
                    </p>
                    <p className="text-xs text-gray-500 dark:text-slate-400">
                      {entry.totalWins}–{losses} · Elo {entry.eloRating}
                    </p>
                  </div>
                  <div className={`shrink-0 text-right text-xs font-medium ${netCamClass(netCam)}`}>
                    <span className="inline-flex items-center justify-end gap-0.5">
                      <OrangeJuiceIcon size={12} />
                      {formatNetCam(netCam)}
                    </span>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-400 dark:text-slate-500" />
                </Link>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block tet-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200/80 dark:border-slate-800 text-left text-xs uppercase tracking-wide text-gray-500 dark:text-slate-400">
              <th className="px-4 py-3 font-semibold w-10">#</th>
              <th className="px-4 py-3 font-semibold">{t("leaderboard.colPlayer")}</th>
              <th className="px-4 py-3 font-semibold text-right">{t("leaderboard.colElo")}</th>
              <th className="px-4 py-3 font-semibold text-right">{t("leaderboard.colWL")}</th>
              <th className="px-4 py-3 font-semibold text-right">
                <span
                  className="inline-flex items-center justify-end"
                  role="img"
                  aria-label={t("drink.label")}
                >
                  <OrangeJuiceIcon size={14} className="text-orange-500 dark:text-orange-400" />
                </span>
              </th>
              <th className="w-8 px-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200/70 dark:divide-slate-800/80">
            {entries.map((entry) => {
              const netCam = entry.debtSummary.netCam;

              return (
                <tr
                  key={entry.id}
                  className={`hover:bg-amber-50/40 dark:hover:bg-white/5 ${rowHighlight(entry.rank)}`}
                >
                  <td className="px-4 py-3">
                    <span className="relative inline-flex items-center justify-center">
                      <RankBadge rank={entry.rank} />
                      {entry.rank <= 3 && (
                        <Crown
                          size={10}
                          className="absolute -top-1.5 text-amber-500 dark:text-amber-300"
                          aria-hidden
                        />
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/members/${entry.id}`}
                      className="flex items-center gap-2 min-w-0 hover:underline"
                    >
                      <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size="sm" />
                      <span className="flex min-w-0 items-center gap-1.5 font-medium text-gray-900 dark:text-slate-50">
                        <span className="truncate">{entry.name}</span>
                        <StreakBadge
                          winStreak={entry.singlesWinStreak}
                          loseStreak={entry.singlesLoseStreak}
                          className="shrink-0"
                        />
                      </span>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-amber-700 dark:text-amber-300">
                    {entry.eloRating}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-slate-400">
                    {entry.totalWins}–{entry.totalMatches - entry.totalWins}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${netCamClass(netCam)}`}>
                    <span className="inline-flex items-center justify-end gap-1">
                      <OrangeJuiceIcon size={12} />
                      {formatNetCam(netCam)}
                    </span>
                  </td>
                  <td className="px-2 py-3 text-slate-400">
                    <Link href={`/members/${entry.id}`} aria-label={entry.name}>
                      <ChevronRight size={16} />
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
