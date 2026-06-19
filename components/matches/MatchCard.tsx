import Link from "next/link";
import { MapPin, Users, RefreshCw, CheckCircle } from "lucide-react";
import type { MatchDTO } from "@/lib/types";

interface MatchCardProps {
  match: MatchDTO;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function totalHeadcount(match: MatchDTO): number {
  return match.registrations.reduce((sum, r) => sum + 1 + r.guests.length, 0);
}

export default function MatchCard({ match }: MatchCardProps) {
  const headcount = totalHeadcount(match);

  return (
    <Link
      href={`/matches/${match.id}`}
      className="block rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 transition hover:shadow-md active:scale-[0.98]"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="flex-1 text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
          {match.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {match.isRecurring && (
            <span className="flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300">
              <RefreshCw size={10} />
              Weekly
            </span>
          )}
          {match.synced && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              <CheckCircle size={10} />
              Synced
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
        <MapPin size={13} className="shrink-0" />
        <span className="truncate">{match.venue}</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">{formatDate(match.scheduledAt)}</span>
        <span className="flex items-center gap-1 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-600 dark:text-gray-300">
          <Users size={12} />
          {headcount} {headcount === 1 ? "player" : "players"}
        </span>
      </div>
    </Link>
  );
}
