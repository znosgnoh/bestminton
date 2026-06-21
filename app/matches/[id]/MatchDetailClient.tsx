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
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <ArrowLeft size={15} />
          All Matches
        </Link>
        <div className="flex justify-center py-16">
          <Loader2 size={28} className="animate-spin text-gray-400 dark:text-gray-500" />
        </div>
      </div>
    );
  }

  if (!match) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
        >
          <ArrowLeft size={15} />
          All Matches
        </Link>
        <div className="rounded-2xl bg-white dark:bg-gray-900 p-8 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 text-center">
          <p className="text-gray-500 dark:text-gray-400 text-sm">Match not found.</p>
        </div>
      </div>
    );
  }

  const isPast = new Date(match.scheduledAt) < new Date();
  const totalHeadcount = registrations.reduce((sum, r) => sum + 1 + r.guests.length, 0);

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
      >
        <ArrowLeft size={15} />
        All Matches
      </Link>

      {/* Match header */}
      <div className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
        <div className="flex items-start justify-between gap-2">
          <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            {match.title}
          </h1>
          {isPast ? (
            <span className="shrink-0 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium text-gray-500 dark:text-gray-400">
              Past
            </span>
          ) : (
            <span className="shrink-0 rounded-full bg-emerald-50 dark:bg-emerald-950 px-2.5 py-1 text-xs font-medium text-emerald-700 dark:text-emerald-300">
              Upcoming
            </span>
          )}
        </div>
        <div className="mt-3 space-y-1.5 text-sm text-gray-500 dark:text-gray-400">
          <div className="flex items-center gap-2">
            <MapPin size={14} className="shrink-0 text-gray-400 dark:text-gray-500" />
            {match.venue}
          </div>
          <div className="flex items-center gap-2">
            <Calendar size={14} className="shrink-0 text-gray-400 dark:text-gray-500" />
            {formatDate(match.scheduledAt)}
          </div>
          <div className="flex items-center gap-2">
            <Clock size={14} className="shrink-0 text-gray-400 dark:text-gray-500" />
            {formatTime(match.scheduledAt)}
          </div>
        </div>
      </div>

      {/* Registration roster */}
      <MemberRoster
        matchId={match.id}
        allMembers={allMembers}
        registrations={registrations}
        setRegistrations={setRegistrations}
        isPast={isPast}
      />

      {/* Registered players list */}
      {registrations.length > 0 && (
        <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
          <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1">
            Registered ({totalHeadcount} player{totalHeadcount !== 1 ? "s" : ""})
          </h2>
          <div className="divide-y divide-gray-50 dark:divide-gray-800">
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

      {/* Post-match settlement (manage context only) */}
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
