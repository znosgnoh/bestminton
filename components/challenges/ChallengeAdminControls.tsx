"use client";

import { useRef, useState } from "react";
import { Loader2, Play, Trophy } from "lucide-react";
import AdminPinModal from "@/components/ui/AdminPinModal";
import ErrorBanner from "@/components/ui/ErrorBanner";
import ResolveConfirmModal from "@/components/challenges/ResolveConfirmModal";
import { useAdminPin } from "@/hooks/useAdminPin";
import { DRINK_LABEL } from "@/lib/constants";
import * as dataService from "@/lib/dataService";
import type { ChallengeDTO, ChallengeSide } from "@/lib/types";

interface ChallengeAdminControlsProps {
  challenge: ChallengeDTO;
  onUpdated: (challenge: ChallengeDTO) => void;
}

type PendingAction =
  | "start"
  | {
      resolve: ChallengeSide;
      confirmedHandicapPoints: number;
      confirmedScore: string;
    }
  | null;

export default function ChallengeAdminControls({
  challenge,
  onUpdated,
}: ChallengeAdminControlsProps) {
  const { unlocked, pinRequired, unlock, getStoredPin } = useAdminPin();
  const pendingActionRef = useRef<PendingAction>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);

  function setPending(action: PendingAction) {
    pendingActionRef.current = action;
    setPendingAction(action);
  }
  const [resolveWinnerSide, setResolveWinnerSide] = useState<ChallengeSide | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  if (challenge.status === "COMPLETED") return null;

  async function runAction(action: PendingAction, pin?: string) {
    if (!action) return;
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      let updated: ChallengeDTO;
      if (action === "start") {
        updated = await dataService.startChallenge(challenge.id, pin);
        setSuccess("Kèo đã bắt đầu — cược đã khóa.");
      } else {
        updated = await dataService.resolveChallenge(
          challenge.id,
          action.resolve,
          action.confirmedHandicapPoints,
          action.confirmedScore,
          pin
        );
        setSuccess(
          challenge.format === "DOUBLES"
            ? challenge.isDrinkChallenge || challenge.bets.length > 0
              ? `Side ${action.resolve} thắng! Đã ghi nợ nước cam.`
              : `Side ${action.resolve} thắng!`
            : challenge.isDrinkChallenge || challenge.bets.length > 0
              ? `Side ${action.resolve} wins! Ratings and ${DRINK_LABEL.toLowerCase()} updated.`
              : `Side ${action.resolve} wins! Ratings updated.`
        );
      }
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Action failed.");
    } finally {
      setLoading(false);
      setPending(null);
      setResolveWinnerSide(null);
    }
  }

  function requestStart() {
    const action: PendingAction = "start";
    setPending(action);
    if (pinRequired && !unlocked) {
      setShowPinModal(true);
    } else {
      void runAction(action, pinRequired ? getStoredPin() : undefined);
    }
  }

  function requestResolve(winnerSide: ChallengeSide) {
    setResolveWinnerSide(winnerSide);
  }

  function handleResolveConfirm(confirmedHandicapPoints: number, confirmedScore: string) {
    if (!resolveWinnerSide) return;
    const action: PendingAction = {
      resolve: resolveWinnerSide,
      confirmedHandicapPoints,
      confirmedScore,
    };
    setPending(action);
    if (pinRequired && !unlocked) {
      setResolveWinnerSide(null);
      setShowPinModal(true);
    } else {
      void runAction(action, pinRequired ? getStoredPin() : undefined);
    }
  }

  async function handlePinSubmit(pin: string): Promise<string | null> {
    const action = pendingActionRef.current;
    const pinError = await unlock(pin);
    if (pinError) return pinError;
    setShowPinModal(false);
    await runAction(action, pin);
    return null;
  }

  function cancelResolve() {
    if (loading) return;
    setResolveWinnerSide(null);
    setPending(null);
  }

  return (
    <div className="tet-card p-4 space-y-3">
      <h2 className="tet-section-title text-sm">Admin Controls</h2>

      {challenge.status === "PENDING" && (
        <button
          onClick={requestStart}
          disabled={loading}
          className="tet-btn-primary w-full flex items-center justify-center gap-2"
        >
          {loading && pendingAction === "start" ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <>
              <Play size={18} />
              Bắt đầu kèo
            </>
          )}
        </button>
      )}

      {challenge.status === "ACTIVE" && (
        <div className="space-y-2">
          <p className="text-xs text-gray-600 dark:text-gray-400">Select the winning side:</p>
          <div className="grid grid-cols-2 gap-2">
            {(["A", "B"] as ChallengeSide[]).map((side) => (
              <button
                key={side}
                onClick={() => requestResolve(side)}
                disabled={loading}
                className="tet-btn-primary flex items-center justify-center gap-2"
              >
                {loading &&
                pendingAction &&
                pendingAction !== "start" &&
                pendingAction.resolve === side ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <>
                    <Trophy size={16} />
                    Side {side} Wins
                  </>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
      {success && <div className="tet-alert-success text-sm">{success}</div>}

      {resolveWinnerSide && (
        <ResolveConfirmModal
          open
          challenge={challenge}
          winnerSide={resolveWinnerSide}
          loading={loading}
          onSubmit={handleResolveConfirm}
          onCancel={cancelResolve}
        />
      )}

      <AdminPinModal
        open={showPinModal}
        title={pendingAction === "start" ? "PIN để bắt đầu kèo" : "PIN để chốt kèo"}
        onSubmit={handlePinSubmit}
        onCancel={() => {
          setShowPinModal(false);
          setPending(null);
          setResolveWinnerSide(null);
        }}
      />
    </div>
  );
}
