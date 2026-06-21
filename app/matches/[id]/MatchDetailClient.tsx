"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, MapPin, Clock, Calendar, Loader2 } from "lucide-react";
import MemberRoster from "@/components/matches/MemberRoster";
import RegistrationRow from "@/components/matches/RegistrationRow";
import SettleForm from "@/components/matches/SettleForm";
import * as dataService from "@/lib/dataService";
import type { MatchDTO, MemberDTO, RegistrationDTO } from "@/lib/types";

interface MatchDetailClientProps {
  matchId: number;
  initialMatch: MatchDTO | null;
  initialMembers: MemberDTO[];
  dbAvailable: boolean;
  splitwiseConfigured: boolean;
  currencyCode: string;
  isManage: boolean;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(new Date(iso));
}

function formatTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function MatchDetailClient({
  matchId,
  initialMatch,
  initialMembers,
  dbAvailable,
  splitwiseConfigured,
  currencyCode,
  isManage,
}: MatchDetailClientProps) {
  const [match, setMatch] = useState<MatchDTO | null>(initialMatch);
  const [allMembers, setAllMembers] = useState<MemberDTO[]>(initialMembers);
  const [registrations, setRegistrations] = useState<RegistrationDTO[]>(
    initialMatch?.registrations ?? []
  );
  const [loading, setLoading] = useState(!dbAvailable);

  useEffect(() => {
    if (!dbAvailable) {
      Promise.all([
        dataService.getMatch(matchId),
        dataService.getMembers(),
      ]).then(([m, members]) => {
        setMatch(m);
        setAllMembers(members);
        setRegistrations(m?.registrations ?? []);
        setLoading(false);
      });
    }
  }, [matchId, dbAvailable]);

  function handleRegistrationUpdated(updated: RegistrationDTO) {
    setRegistrations((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4">
        <Link href="/" className="tet-link">
          <ArrowLeft size={15} />
          All Matches
        </Link>
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-emerald-500 dark:text-amber-400" />
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <Link href="/" className="tet-link">
          <ArrowLeft size={15} />
          All Matches
        </Link>
        <div className="tet-card p-8 text-center">
          <p className="text-sm text-gray-600 dark:text-gray-400">Match not found.</p>
        </div>
      </div>
    );
  }

  const isPast = new Date(match.scheduledAt) < new Date();
  const totalHeadcount = registrations.reduce((sum, r) => sum + 1 + r.guests.length, 0);

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <Link href="/" className="tet-link">
        <ArrowLeft size={15} />
        All Matches
      </Link>

      <div className="tet-card p-5">
        <div className="flex items-start justify-between gap-2">
          <h1 className="font-heading text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            {match.title}
          </h1>
          {isPast ? (
            <span className="tet-badge-past">Past</span>
          ) : (
            <span className="tet-badge-upcoming">Upcoming</span>
          )}
        </div>
        <div className="mt-3 space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="shrink-0 text-amber-600 dark:text-amber-400" />
            {match.venue}
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            {formatDate(match.scheduledAt)}
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
            {formatTime(match.scheduledAt)}
          </div>
        </div>
      </div>

      <MemberRoster
        matchId={match.id}
        allMembers={allMembers}
        registrations={registrations}
        setRegistrations={setRegistrations}
        isPast={isPast}
      />

      {registrations.length > 0 && (
        <div className="tet-card p-4">
          <h2 className="tet-section-title text-sm mb-1">
            Registered ({totalHeadcount} player{totalHeadcount !== 1 ? "s" : ""})
          </h2>
          <div className="divide-y divide-amber-100/60 dark:divide-gray-800">
            {registrations.map((reg) => (
              <RegistrationRow
                key={reg.id}
                registration={reg}
                matchId={match.id}
                isPast={isPast}
                onUpdated={handleRegistrationUpdated}
              />
            ))}
          </div>
        </div>
      )}

      {isPast && isManage && (
        <SettleForm
          match={match}
          registrations={registrations}
          splitwiseConfigured={splitwiseConfigured}
          currencyCode={currencyCode}
        />
      )}
    </div>
  );
}
