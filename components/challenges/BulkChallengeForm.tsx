"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Minus, Plus } from "lucide-react";
import AvatarTile from "@/components/matches/AvatarTile";
import AdminPinModal from "@/components/ui/AdminPinModal";
import ErrorBanner from "@/components/ui/ErrorBanner";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import PointsToWinToggle from "@/components/challenges/PointsToWinToggle";
import { useI18n } from "@/contexts/LocaleContext";
import { useMemberPin } from "@/hooks/useMemberPin";
import {
  BULK_MAX_MEMBERS,
  BULK_MAX_PER_PAIR,
  BULK_MIN_MEMBERS,
  BULK_MIN_PER_PAIR,
  bulkChallengeCount,
  pairCount,
} from "@/lib/bulkChallenges";
import { DRINK_CHALLENGE_LABEL } from "@/lib/constants";
import { DEFAULT_POINTS_TO_WIN, type PointsToWin } from "@/lib/elo";
import * as dataService from "@/lib/dataService";
import type { MemberDTO } from "@/lib/types";

interface BulkChallengeFormProps {
  members: MemberDTO[];
  onCreated: (count: number) => void;
}

export default function BulkChallengeForm({ members, onCreated }: BulkChallengeFormProps) {
  const { t } = useI18n();
  const { unlocked, pinRequired, unlock, getStoredPin } = useMemberPin();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const [perPair, setPerPair] = useState(BULK_MIN_PER_PAIR);
  const [pointsToWin, setPointsToWin] = useState<PointsToWin>(DEFAULT_POINTS_TO_WIN);
  const [isDrinkChallenge, setIsDrinkChallenge] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const pendingSubmitRef = useRef(false);

  const selectedCount = selectedIds.size;
  const pairs = pairCount(selectedCount);
  const total = bulkChallengeCount(selectedCount, perPair);
  const canSubmit = selectedCount >= BULK_MIN_MEMBERS && total > 0 && !submitting;
  const atMaxMembers = selectedCount >= BULK_MAX_MEMBERS;

  const selectedMembers = useMemo(
    () => members.filter((m) => selectedIds.has(m.id)),
    [members, selectedIds]
  );

  function toggleMember(memberId: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else if (next.size < BULK_MAX_MEMBERS) {
        next.add(memberId);
      }
      return next;
    });
  }

  async function createBulk(pin?: string) {
    setSubmitting(true);
    setError(null);
    try {
      const result = await dataService.createBulkChallenges({
        memberIds: [...selectedIds],
        perPair,
        pointsToWin,
        isDrinkChallenge,
        ...(pin ? { pin } : {}),
      });
      onCreated(result.created);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("challenges.bulkFailed"));
    } finally {
      setSubmitting(false);
      pendingSubmitRef.current = false;
    }
  }

  function requestCreate() {
    if (!canSubmit) return;
    pendingSubmitRef.current = true;
    if (pinRequired && !unlocked) {
      setShowPinModal(true);
      return;
    }
    void createBulk(pinRequired ? getStoredPin() : undefined);
  }

  async function handlePinSubmit(pin: string): Promise<string | null> {
    const pinError = await unlock(pin);
    if (pinError) return pinError;
    setShowPinModal(false);
    if (pendingSubmitRef.current) {
      await createBulk(pin);
    }
    return null;
  }

  if (members.length === 0) {
    return (
      <p className="text-sm text-gray-600 dark:text-gray-400 text-center py-4">
        {t("matches.noMembers")}{" "}
        <a href="/management" className="tet-link-accent">
          {t("matches.management")}
        </a>
        .
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="tet-section-title text-sm mb-3">
          {selectedCount === 0
            ? t("matches.tapRegister")
            : t("challenges.bulkSelectedCount", { count: selectedCount })}
        </h2>
        <div className="flex flex-wrap gap-1">
          {members.map((member) => {
            const selected = selectedIds.has(member.id);
            return (
              <AvatarTile
                key={member.id}
                member={member}
                registered={selected}
                disabled={submitting || (!selected && atMaxMembers)}
                onToggle={() => toggleMember(member.id)}
              />
            );
          })}
        </div>
        {atMaxMembers && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            {t("challenges.bulkMaxMembers", { max: BULK_MAX_MEMBERS })}
          </p>
        )}
      </div>

      {selectedCount >= BULK_MIN_MEMBERS ? (
        <>
          <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-100/80 bg-amber-50/40 p-3 dark:border-gray-700 dark:bg-gray-800/40">
            <div className="min-w-0">
              <p className="tet-label">{t("challenges.bulkPerPair")}</p>
              <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                {t("challenges.bulkPerPairHint")}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                className="tet-btn-icon"
                aria-label={t("challenges.bulkDecrease")}
                disabled={perPair <= BULK_MIN_PER_PAIR || submitting}
                onClick={() => setPerPair((prev) => Math.max(BULK_MIN_PER_PAIR, prev - 1))}
              >
                <Minus size={18} />
              </button>
              <span className="min-w-8 text-center text-lg font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                {perPair}
              </span>
              <button
                type="button"
                className="tet-btn-icon"
                aria-label={t("challenges.bulkIncrease")}
                disabled={perPair >= BULK_MAX_PER_PAIR || submitting}
                onClick={() => setPerPair((prev) => Math.min(BULK_MAX_PER_PAIR, prev + 1))}
              >
                <Plus size={18} />
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-600 dark:text-gray-400">
            {t("challenges.bulkSummary", { pairs, perPair, total })}
          </p>

          {selectedMembers.length > 0 && selectedMembers.length <= 8 && (
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {selectedMembers.map((m) => m.name).join(" · ")}
            </p>
          )}

          <div className="rounded-xl border border-amber-100/80 bg-amber-50/40 px-3 py-3 dark:border-gray-700 dark:bg-gray-800/40">
            <p className="tet-label mb-2 text-center">{t("challenges.pointsToWinLabel")}</p>
            <PointsToWinToggle
              value={pointsToWin}
              onChange={setPointsToWin}
              disabled={submitting}
            />
          </div>

          <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-amber-100/80 bg-amber-50/40 p-3 dark:border-gray-700 dark:bg-gray-800/40">
            <input
              type="checkbox"
              checked={isDrinkChallenge}
              onChange={(e) => setIsDrinkChallenge(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
            />
            <span className="flex-1">
              <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
                <OrangeJuiceIcon size={16} className="text-orange-500 dark:text-orange-400" />
                {DRINK_CHALLENGE_LABEL}
              </span>
              <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
                {t("challenges.bulkDrinkHint")}
              </span>
            </span>
          </label>

          {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}

          <button
            type="button"
            onClick={requestCreate}
            disabled={!canSubmit}
            className="tet-btn-primary-lg w-full"
          >
            {submitting ? (
              <Loader2 size={20} className="mx-auto animate-spin" />
            ) : (
              t("challenges.bulkCreate", { count: total })
            )}
          </button>
        </>
      ) : (
        <p className="text-sm text-gray-500 dark:text-gray-400">{t("challenges.bulkNeedTwo")}</p>
      )}

      <AdminPinModal
        open={showPinModal}
        title={t("challenges.bulkPin")}
        onSubmit={handlePinSubmit}
        onCancel={() => {
          setShowPinModal(false);
          pendingSubmitRef.current = false;
        }}
      />
    </div>
  );
}
