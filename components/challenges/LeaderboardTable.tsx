import Avatar from "@/components/ui/Avatar";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { DRINK_LABEL, formatDrinkAmountShort } from "@/lib/constants";
import type { LeaderboardEntryDTO } from "@/lib/types";

interface LeaderboardTableProps {
  entries: LeaderboardEntryDTO[];
}

function formatNetCam(net: number): string {
  if (net === 0) return formatDrinkAmountShort(0);
  const prefix = net > 0 ? "+" : "-";
  return `${prefix}${formatDrinkAmountShort(Math.abs(net))}`;
}

function netCamClass(net: number): string {
  if (net > 0) return "text-green-600 dark:text-green-400";
  if (net < 0) return "text-red-600 dark:text-red-400";
  return "text-gray-600 dark:text-gray-400";
}

export default function LeaderboardTable({ entries }: LeaderboardTableProps) {
  if (entries.length === 0) {
    return (
      <div className="tet-empty">
        <p>No members yet. Add players from the management page.</p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: compact card rows */}
      <div className="tet-card overflow-hidden md:hidden">
        <ul className="divide-y divide-amber-100/60 dark:divide-gray-800" aria-label="Leaderboard">
          {entries.map((entry) => {
            const { debtSummary } = entry;
            const losses = entry.totalMatches - entry.totalWins;

            return (
              <li key={entry.id} className="flex items-center gap-3 px-3 py-3">
                <span className="w-6 shrink-0 text-center text-sm font-bold text-gray-400">
                  {entry.rank}
                </span>
                <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                    {entry.name}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {entry.totalWins}–{losses} · Elo {entry.eloRating}
                  </p>
                </div>
                <div className={`shrink-0 text-right text-xs font-medium ${netCamClass(debtSummary.netCam)}`}>
                  <span className="inline-flex items-center justify-end gap-0.5">
                    <OrangeJuiceIcon size={12} />
                    {formatNetCam(debtSummary.netCam)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Desktop: table */}
      <div className="hidden md:block tet-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-amber-100/80 dark:border-gray-800 text-left text-xs text-gray-500 dark:text-gray-400">
              <th className="px-4 py-3 font-semibold w-10">#</th>
              <th className="px-4 py-3 font-semibold">Player</th>
              <th className="px-4 py-3 font-semibold text-right">Elo</th>
              <th className="px-4 py-3 font-semibold text-right">W–L</th>
              <th className="px-4 py-3 font-semibold text-right">
                <span
                  className="inline-flex items-center justify-end"
                  role="img"
                  aria-label={DRINK_LABEL}
                >
                  <OrangeJuiceIcon size={14} className="text-orange-500 dark:text-orange-400" />
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100/60 dark:divide-gray-800">
            {entries.map((entry) => {
              const { debtSummary } = entry;

              return (
                <tr key={entry.id} className="hover:bg-amber-50/40 dark:hover:bg-gray-800/40">
                  <td className="px-4 py-3 font-bold text-gray-400">{entry.rank}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar name={entry.name} avatarUrl={entry.avatarUrl} size="sm" />
                      <span className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {entry.name}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-emerald-700 dark:text-amber-400">
                    {entry.eloRating}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                    {entry.totalWins}–{entry.totalMatches - entry.totalWins}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${netCamClass(debtSummary.netCam)}`}>
                    <span className="inline-flex items-center justify-end gap-1">
                      <OrangeJuiceIcon size={12} />
                      {formatNetCam(debtSummary.netCam)}
                    </span>
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
