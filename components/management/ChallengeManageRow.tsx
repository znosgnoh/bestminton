"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2, Pencil, Trash2, Trophy } from "lucide-react";
import AdminPinModal from "@/components/ui/AdminPinModal";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorBanner from "@/components/ui/ErrorBanner";
import StatusBadge from "@/components/ui/StatusBadge";
import { useAdminPin } from "@/hooks/useAdminPin";
import { DRINK_LABEL } from "@/lib/constants";
import * as dataService from "@/lib/dataService";
import type { ChallengeDTO, ChallengeSide } from "@/lib/types";

interface ChallengeManageRowProps {
  challenge: ChallengeDTO;
  onUpdated: (c: ChallengeDTO) => void;
  onDeleted: (id: number) => void;
}

function formatPlayers(challenge: ChallengeDTO): string {
  const sideA = challenge.sideA.players.map((p) => p.name).join(" & ");
  const sideB = challenge.sideB.players.map((p) => p.name).join(" & ");
  return `${sideA} vs ${sideB}`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

type PendingAction =
  | { type: "editWinner"; side: ChallengeSide }
  | { type: "delete"; confirmDebts: boolean }
  | null;

export default function ChallengeManageRow({
  challenge,
  onUpdated,
  onDeleted,
}: ChallengeManageRowProps) {
  const { unlocked, pinRequired, unlock, getStoredPin } = useAdminPin();
  const [editing, setEditing] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteNeedsDebtConfirm, setDeleteNeedsDebtConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debtCount = challenge.resolution?.debts?.length ?? 0;

  async function runAction(action: PendingAction, pin?: string) {
    if (!action) return;
    setLoading(true);
    setError(null);

    try {
      if (action.type === "editWinner") {
        const updated = await dataService.adminEditChallengeWinner(
          challenge.id,
          action.side,
          pin
        );
        onUpdated(updated);
        setEditing(false);
      } else {
        await dataService.adminDeleteChallenge(challenge.id, {
          confirmDebts: action.confirmDebts,
          pin,
        });
        onDeleted(challenge.id);
      }
      setShowDeleteConfirm(false);
      setDeleteNeedsDebtConfirm(false);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Action failed.";
      if (action.type === "delete" && message.includes("drink debt")) {
        setDeleteNeedsDebtConfirm(true);
        setShowDeleteConfirm(true);
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
      setPendingAction(null);
    }
  }

  function requestAction(action: PendingAction) {
    setPendingAction(action);
    if (pinRequired && !unlocked) {
      setShowPinModal(true);
    } else {
      void runAction(action, pinRequired ? getStoredPin() : undefined);
    }
  }

  function startEditWinner(side: ChallengeSide) {
    requestAction({ type: "editWinner", side });
  }

  function startDelete() {
    setDeleteNeedsDebtConfirm(debtCount > 0);
    setShowDeleteConfirm(true);
  }

  function confirmDelete() {
    setShowDeleteConfirm(false);
    requestAction({ type: "delete", confirmDebts: deleteNeedsDebtConfirm });
  }

  async function handlePinSubmit(pin: string): Promise<string | null> {
    const pinError = await unlock(pin);
    if (pinError) return pinError;
    setShowPinModal(false);
    await runAction(pendingAction, pin);
    return null;
  }

  const deleteMessage = deleteNeedsDebtConfirm
    ? `Delete this challenge? It created ${debtCount} ${DRINK_LABEL.toLowerCase()} debt record(s) that will NOT be reversed. Elo changes will be reverted.`
    : challenge.status === "COMPLETED"
      ? "Delete this challenge? Elo changes will be reverted. This cannot be undone."
      : "Delete this challenge? This cannot be undone.";

  return (
    <>
      <div className="tet-card p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-gray-900 dark:text-gray-100 text-sm leading-snug">
              {formatPlayers(challenge)}
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {challenge.format === "DOUBLES" ? "Doubles" : "Singles"} ·{" "}
              {formatDate(challenge.completedAt ?? challenge.createdAt)}
            </p>
            {challenge.status === "COMPLETED" && challenge.winnerSide && (
              <p className="mt-1 text-xs text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1">
                <Trophy size={12} />
                Side {challenge.winnerSide} won
              </p>
            )}
            {debtCount > 0 && (
              <p className="mt-1 text-xs text-orange-600 dark:text-orange-400">
                {debtCount} drink debt record(s) on file
              </p>
            )}
          </div>
          <StatusBadge status={challenge.status} />
        </div>

        <div className="flex flex-wrap gap-2">
          <Link
            href={`/challenges/${challenge.id}`}
            className="tet-btn-ghost text-xs px-3 py-2 inline-flex items-center gap-1"
          >
            <ExternalLink size={14} />
            View
          </Link>

          {challenge.status === "COMPLETED" && (
            <button
              type="button"
              onClick={() => setEditing((v) => !v)}
              disabled={loading}
              className="tet-btn-ghost text-xs px-3 py-2 inline-flex items-center gap-1"
            >
              <Pencil size={14} />
              {editing ? "Cancel" : "Edit winner"}
            </button>
          )}

          <button
            type="button"
            onClick={startDelete}
            disabled={loading}
            className="tet-btn-icon-danger text-xs px-3 py-2 inline-flex items-center gap-1"
          >
            {loading && pendingAction?.type === "delete" ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <Trash2 size={14} />
            )}
            Delete
          </button>
        </div>

        {editing && challenge.status === "COMPLETED" && (
          <div className="border-t border-gray-100 dark:border-gray-800 pt-3 space-y-2">
            <p className="text-xs text-gray-600 dark:text-gray-400">
              Set winning side (Elo will be recalculated; drink debts are not adjusted):
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(["A", "B"] as ChallengeSide[]).map((side) => (
                <button
                  key={side}
                  type="button"
                  onClick={() => startEditWinner(side)}
                  disabled={loading || challenge.winnerSide === side}
                  className={`tet-btn-primary text-sm py-2.5 ${
                    challenge.winnerSide === side ? "opacity-50" : ""
                  }`}
                >
                  {loading &&
                  pendingAction?.type === "editWinner" &&
                  pendingAction.side === side ? (
                    <Loader2 size={16} className="mx-auto animate-spin" />
                  ) : (
                    <>Side {side} Wins</>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
      </div>

      <ConfirmDialog
        open={showDeleteConfirm}
        title="Delete Challenge"
        message={deleteMessage}
        confirmLabel={deleteNeedsDebtConfirm ? "Delete anyway" : "Delete"}
        onConfirm={confirmDelete}
        onCancel={() => {
          setShowDeleteConfirm(false);
          setDeleteNeedsDebtConfirm(false);
        }}
      />

      <AdminPinModal
        open={showPinModal}
        title={
          pendingAction?.type === "delete"
            ? "PIN to Delete"
            : "PIN to Edit Winner"
        }
        onSubmit={handlePinSubmit}
        onCancel={() => {
          setShowPinModal(false);
          setPendingAction(null);
        }}
      />
    </>
  );
}
