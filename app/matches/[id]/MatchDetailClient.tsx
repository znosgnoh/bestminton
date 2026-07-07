"use client";

import { useState, useEffect, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, MapPin, Clock, Calendar } from "lucide-react";
import { MatchDetailSkeleton } from "@/components/ui/Skeleton";
import AdminPinModal from "@/components/ui/AdminPinModal";
import MemberRoster from "@/components/matches/MemberRoster";
import RegistrationRow from "@/components/matches/RegistrationRow";
import SettleForm from "@/components/matches/SettleForm";
import { YouTubeUrlEditor } from "@/components/ui/YouTubeVideo";
import { useI18n } from "@/contexts/LocaleContext";
import { useAdminPin } from "@/hooks/useAdminPin";
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

function MatchDetailClientInner({
  matchId,
  initialMatch,
  initialMembers,
  dbAvailable,
  splitwiseConfigured,
  currencyCode,
  isManage,
}: MatchDetailClientProps) {
  const searchParams = useSearchParams();
  const isManageMode = isManage || searchParams.get("manage") === "1";
  const { t } = useI18n();
  const { unlocked, pinRequired, checking, unlock } = useAdminPin();

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

  if (loading || checking) {
    return <MatchDetailSkeleton />;
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
  const canManagePast = (isManageMode || unlocked) && (!pinRequired || unlocked);
  const canEditRegistration = !isPast || canManagePast;
  const needsCaptainPin = isPast && pinRequired && !unlocked && isManageMode;
  const totalHeadcount = registrations.reduce((sum, r) => sum + 1 + r.guests.length, 0);

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <AdminPinModal
        open={needsCaptainPin}
        title="Enter Captain PIN"
        onSubmit={unlock}
        onCancel={() => {
          window.location.href = "/management";
        }}
      />

      <Link href="/" className="tet-link">
        <ArrowLeft size={15} />
        All Matches
      </Link>

      {isPast && !canManagePast && (
        <div className="tet-alert-info">
          <p className="text-sm">
            To update who played or settle costs, open this match from{" "}
            <Link href="/management" className="tet-link-accent font-medium">
              Management
            </Link>{" "}
            or use{" "}
            <Link href={`/matches/${match.id}?manage=1`} className="tet-link-accent font-medium">
              settle view
            </Link>
            .
          </p>
        </div>
      )}

      <div className="tet-card p-5">
        <div className="flex items-start justify-between gap-2">
          <h1 className="font-heading text-xl font-bold text-gray-900 dark:text-gray-100 leading-tight">
            {match.title}
          </h1>
          {isPast ? (
            <span className="tet-badge-past">{t("common.pastBadge")}</span>
          ) : (
            <span className="tet-badge-upcoming">{t("common.upcomingBadge")}</span>
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

      <YouTubeUrlEditor
        url={match.youtubeUrl}
        editable={isManageMode && canManagePast}
        onSave={async (youtubeUrl) => {
          const updated = await dataService.saveMatchYoutubeUrl(match.id, youtubeUrl);
          setMatch(updated);
        }}
      />

      <MemberRoster
        matchId={match.id}
        allMembers={allMembers}
        registrations={registrations}
        setRegistrations={setRegistrations}
        isPast={isPast}
        canEditRegistration={canEditRegistration}
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
                canEditRegistration={canEditRegistration}
                onUpdated={handleRegistrationUpdated}
              />
            ))}
          </div>
        </div>
      )}

      {isPast && canManagePast && (
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

export default function MatchDetailClient(props: MatchDetailClientProps) {
  return (
    <Suspense fallback={<MatchDetailSkeleton />}>
      <MatchDetailClientInner {...props} />
    </Suspense>
  );
}
