"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { MapPin, Users, RefreshCw, CheckCircle, Loader2 } from "lucide-react";
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
  const pathname = usePathname();
  const [navigating, setNavigating] = useState(false);
  const headcount = totalHeadcount(match);
  const href = `/matches/${match.id}`;

  useEffect(() => {
    setNavigating(false);
  }, [pathname]);

  return (
    <Link
      href={href}
      onClick={() => setNavigating(true)}
      aria-busy={navigating}
      className={`tet-card-hover relative block p-4 transition-opacity duration-200 ${
        navigating ? "pointer-events-none opacity-70" : ""
      }`}
    >
      {navigating && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl bg-white/50 dark:bg-gray-950/50">
          <Loader2 size={22} className="animate-spin text-emerald-600 dark:text-amber-400" />
        </div>
      )}

      <div className="flex items-start justify-between gap-2">
        <h3 className="flex-1 font-heading text-base font-semibold text-gray-900 dark:text-gray-100 leading-tight">
          {match.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {match.isRecurring && (
            <span className="tet-badge-gold">
              <RefreshCw size={10} />
              Weekly
            </span>
          )}
          {match.synced && (
            <span className="tet-badge-synced">
              <CheckCircle size={10} />
              Synced
            </span>
          )}
        </div>
      </div>

      <div className="mt-2 flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-400">
        <MapPin size={13} className="shrink-0 text-amber-600 dark:text-amber-400" />
        <span className="truncate">{match.venue}</span>
      </div>

      <div className="mt-3 flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">{formatDate(match.scheduledAt)}</span>
        <span className="tet-badge-count">
          <Users size={12} />
          {headcount} {headcount === 1 ? "player" : "players"}
        </span>
      </div>
    </Link>
  );
}
