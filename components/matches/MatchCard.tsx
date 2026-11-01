"use client";

import Link from "next/link";
import { MapPin, Users, RefreshCw, CheckCircle, Play } from "lucide-react";
import TournamentBadge from "./TournamentBadge";
import { formatLocal } from "@/lib/datetime";
import type { MatchDTO } from "@/lib/types";

interface MatchCardProps {
  match: MatchDTO;
}

function formatDate(iso: string): string {
  return formatLocal(iso, "en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function totalHeadcount(match: MatchDTO): number {
  return match.registrations.reduce((sum, r) => sum + 1 + r.guests.length, 0);
}

export default function MatchCard({ match }: MatchCardProps) {
  const headcount = totalHeadcount(match);
  const tournament = match.isTournament;

  return (
    <Link
      href={`/matches/${match.id}`}
      className={`${tournament ? "tournament-card-hover" : "tet-card-hover"} block p-4`}
    >
      {tournament && (
        <span
          className="tournament-ember pointer-events-none absolute -top-10 right-0 h-28 w-36 rounded-full bg-orange-400/30 blur-3xl"
          aria-hidden
        />
      )}
      <div className="relative flex items-start justify-between gap-2">
        <h3
          className={`flex-1 font-heading text-base font-semibold leading-tight ${
            tournament
              ? "text-orange-950 dark:text-orange-50"
              : "text-gray-900 dark:text-gray-100"
          }`}
        >
          {match.title}
        </h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {tournament && <TournamentBadge />}
          {match.isRecurring && (
            <span className="tet-badge-gold">
              <RefreshCw size={10} />
              Weekly
            </span>
          )}
          {match.synced && (
            <span className="tet-badge-synced">
              <CheckCircle size={10} />
              Recorded
            </span>
          )}
        </div>
      </div>

      <div
        className={`relative mt-2 flex items-center gap-1.5 text-sm ${
          tournament
            ? "text-orange-900/75 dark:text-orange-100/75"
            : "text-gray-600 dark:text-gray-400"
        }`}
      >
        <MapPin
          size={13}
          className={`shrink-0 ${
            tournament
              ? "text-orange-500 dark:text-orange-400"
              : "text-amber-600 dark:text-amber-400"
          }`}
        />
        <span className="truncate">{match.venue}</span>
      </div>

      <div className="relative mt-3 flex items-center justify-between">
        <span
          className={`text-sm ${
            tournament
              ? "text-orange-900/70 dark:text-orange-100/70"
              : "text-gray-600 dark:text-gray-400"
          }`}
        >
          {formatDate(match.scheduledAt)}
        </span>
        <div className="flex items-center gap-2">
          {match.youtubeUrl && (
            <span className="inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400" title="Có video YouTube">
              <Play size={12} />
            </span>
          )}
          <span className="tet-badge-count">
            <Users size={12} />
            {headcount} {headcount === 1 ? "player" : "players"}
          </span>
        </div>
      </div>
    </Link>
  );
}
