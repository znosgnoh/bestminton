"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import AdminPinModal from "@/components/ui/AdminPinModal";
import ErrorBanner from "@/components/ui/ErrorBanner";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import StreakBadge from "@/components/ui/StreakBadge";
import EloHistoryChart from "@/components/profile/EloHistoryChart";
import ProfileChallengeHistory from "@/components/profile/ProfileChallengeHistory";
import ProfileCollapsibleSection from "@/components/profile/ProfileCollapsibleSection";
import ProfileMatchHistory from "@/components/profile/ProfileMatchHistory";
import { useRegisterPullToRefresh } from "@/components/PullToRefresh";
import { useI18n } from "@/contexts/LocaleContext";
import { useMemberPin } from "@/hooks/useMemberPin";
import * as dataService from "@/lib/dataService";
import type { MemberProfileDTO } from "@/lib/types";

interface MemberProfileClientProps {
  profile: MemberProfileDTO | null;
  dbAvailable: boolean;
  dbError?: string;
}

function netCamClass(net: number): string {
  if (net > 0) return "text-green-600 dark:text-green-400";
  if (net < 0) return "text-red-600 dark:text-red-400";
  return "text-gray-600 dark:text-gray-400";
}

function formatNetCam(net: number): string {
  if (net === 0) return "0";
  return `${net > 0 ? "+" : "-"}${Math.abs(net)}`;
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl bg-amber-50/70 px-3 py-2.5 dark:bg-gray-800/60">
      <p className="text-[10px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {label}
      </p>
      <p className="mt-0.5 text-lg font-bold text-gray-900 dark:text-gray-100">{value}</p>
    </div>
  );
}

export default function MemberProfileClient({
  profile: initialProfile,
  dbAvailable,
  dbError,
}: MemberProfileClientProps) {
  const { t } = useI18n();
  const { unlocked, pinRequired, unlock } = useMemberPin();
  const [profile, setProfile] = useState(initialProfile);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pendingEmailPref, setPendingEmailPref] = useState<boolean | null>(null);
  const [emailPrefSaving, setEmailPrefSaving] = useState(false);
  const [emailPrefError, setEmailPrefError] = useState<string | null>(null);

  useEffect(() => {
    setProfile(initialProfile);
  }, [initialProfile]);

  const refreshProfile = useCallback(async () => {
    if (!initialProfile?.member.id) return;
    const next = await dataService.getMemberProfile(initialProfile.member.id);
    setProfile(next);
  }, [initialProfile?.member.id]);

  useRegisterPullToRefresh(refreshProfile);

  const applyEmailPref = useCallback(
    async (enabled: boolean) => {
      if (!profile?.member.id) return;
      setEmailPrefSaving(true);
      setEmailPrefError(null);
      try {
        const updated = await dataService.updateMemberEmailPreferences(
          profile.member.id,
          enabled
        );
        setProfile((current) =>
          current
            ? {
                ...current,
                member: {
                  ...current.member,
                  emailNotificationsEnabled: updated.emailNotificationsEnabled,
                },
              }
            : current
        );
      } catch (err) {
        setEmailPrefError(err instanceof Error ? err.message : t("profile.emailPrefError"));
      } finally {
        setEmailPrefSaving(false);
      }
    },
    [profile?.member.id, t]
  );

  const onToggleEmailPref = useCallback(
    (checked: boolean) => {
      if (pinRequired && !unlocked) {
        setPendingEmailPref(checked);
        setShowPinModal(true);
        return;
      }
      void applyEmailPref(checked);
    },
    [applyEmailPref, pinRequired, unlocked]
  );

  if (!dbAvailable) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <BackLink />
        <ErrorBanner message={dbError ?? t("profile.dbRequired")} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
        <BackLink />
        <ErrorBanner message={t("profile.notFound")} />
      </div>
    );
  }

  const { member, rank, winRate, stats, matchHistory, challengeHistory, eloHistory } = profile;
  const losses = member.totalMatches - member.totalWins;
  const winPct = Math.round(winRate * 100);
  const netCam = member.debtSummary.netCam;

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <BackLink />

      {/* Header */}
      <section className="tet-card p-5">
        <div className="flex items-center gap-4">
          <Avatar name={member.name} avatarUrl={member.avatarUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="flex items-center gap-2 tet-page-title min-w-0">
              <span className="truncate">{member.name}</span>
              <StreakBadge
                winStreak={member.singlesWinStreak}
                loseStreak={member.singlesLoseStreak}
                className="shrink-0"
              />
            </h1>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              {rank != null && (
                <span>
                  {t("profile.rank", { rank })} ·{" "}
                </span>
              )}
              Elo {member.eloRating}
            </p>
            {member.email && (
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400 truncate">
                {member.email}
              </p>
            )}
            {member.email && (
              <label className="mt-2 flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={member.emailNotificationsEnabled}
                  disabled={emailPrefSaving}
                  onChange={(e) => onToggleEmailPref(e.target.checked)}
                />
                <span>{t("profile.emailNotifications")}</span>
              </label>
            )}
            {emailPrefError && (
              <p className="mt-1 text-xs text-red-600 dark:text-red-400">{emailPrefError}</p>
            )}
            <p className={`mt-1 inline-flex items-center gap-1 text-sm font-medium ${netCamClass(netCam)}`}>
              <OrangeJuiceIcon size={14} />
              {formatNetCam(netCam)}
            </p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatTile label={t("profile.statWL")} value={`${member.totalWins}–${losses}`} />
          <StatTile label={t("profile.statWinRate")} value={`${winPct}%`} />
          <StatTile label={t("profile.statSessions")} value={stats.sessionsPlayed} />
          <StatTile label={t("profile.statPeakElo")} value={stats.peakElo} />
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-gray-400">
          <p>
            {t("profile.singlesRecord", {
              wins: stats.singlesWins,
              played: stats.singlesPlayed,
            })}
          </p>
          <p>
            {t("profile.doublesRecord", {
              wins: stats.doublesWins,
              played: stats.doublesPlayed,
            })}
          </p>
        </div>
      </section>

      <AdminPinModal
        open={showPinModal}
        title={t("profile.emailPrefPinTitle")}
        onCancel={() => {
          setShowPinModal(false);
          setPendingEmailPref(null);
        }}
        onSubmit={async (pin) => {
          const err = await unlock(pin);
          if (err) return err;
          setShowPinModal(false);
          if (pendingEmailPref != null) {
            const next = pendingEmailPref;
            setPendingEmailPref(null);
            void applyEmailPref(next);
          }
          return null;
        }}
      />

      {/* Ability / Elo chart */}
      <ProfileCollapsibleSection
        title={t("profile.abilityTitle")}
        subtitle={t("profile.abilitySubtitle")}
        count={eloHistory.length}
        defaultOpen
      >
        <EloHistoryChart history={eloHistory} currentElo={member.eloRating} />
      </ProfileCollapsibleSection>

      {/* Challenge history */}
      <ProfileCollapsibleSection
        title={t("profile.challengeHistory")}
        count={challengeHistory.length}
      >
        <ProfileChallengeHistory challenges={challengeHistory} />
      </ProfileCollapsibleSection>

      {/* Match / session history */}
      <ProfileCollapsibleSection
        title={t("profile.matchHistory")}
        count={matchHistory.length}
      >
        <ProfileMatchHistory matches={matchHistory} />
      </ProfileCollapsibleSection>
    </div>
  );
}

function BackLink() {
  const { t } = useI18n();
  return (
    <Link
      href="/leaderboard"
      className="tet-link inline-flex items-center gap-1.5 text-sm"
    >
      <ArrowLeft size={14} />
      {t("profile.backToLeaderboard")}
    </Link>
  );
}
