"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2 } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";
import type { ChallengeDTO, ChallengeSide } from "@/lib/types";

interface ResolveConfirmModalProps {
  open: boolean;
  challenge: ChallengeDTO;
  winnerSide: ChallengeSide;
  loading?: boolean;
  onSubmit: (confirmedHandicapPoints: number, confirmedScore: string) => void;
  onCancel: () => void;
}

export default function ResolveConfirmModal({
  open,
  challenge,
  winnerSide,
  loading = false,
  onSubmit,
  onCancel,
}: ResolveConfirmModalProps) {
  const { t } = useI18n();
  const [handicap, setHandicap] = useState(String(challenge.handicapPoints));
  const [score, setScore] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (open) {
      setHandicap(String(challenge.handicapPoints));
      setScore("");
      setError(null);
    }
  }, [open, challenge.handicapPoints]);

  if (!open || !mounted) return null;

  function parseHandicapValue(raw: string): number | null {
    const trimmed = raw.trim();
    if (trimmed === "") {
      return challenge.handicapPoints;
    }
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      return null;
    }
    const asInt = Math.trunc(parsed);
    if (!Number.isInteger(asInt) || parsed !== asInt) {
      return null;
    }
    return asInt;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const maxHcp = challenge.pointsToWin;
    const parsedHandicap = parseHandicapValue(handicap);
    if (parsedHandicap === null || parsedHandicap < 0 || parsedHandicap > maxHcp) {
      setError(t("challenges.handicapRange", { max: maxHcp }));
      return;
    }
    const trimmedScore = score.trim();
    if (!trimmedScore) {
      setError(t("challenges.scoreRequired"));
      return;
    }
    if (trimmedScore.length > 80) {
      setError(t("challenges.scoreTooLong"));
      return;
    }
    onSubmit(parsedHandicap, trimmedScore);
  }

  const recipientSide = challenge.handicapRecipientSide;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="tet-card w-full max-w-sm p-6 shadow-xl ring-amber-200/60 dark:ring-amber-900/40"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="tet-section-title">{t("challenges.resolveTitle")}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          {t("challenges.resolveBody", { side: winnerSide })}
          {challenge.format === "DOUBLES" && (
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {t("challenges.resolveDoublesNote")}
            </span>
          )}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="resolve-handicap" className="tet-label">
              {t("challenges.handicapLabel")}
            </label>
            <input
              id="resolve-handicap"
              type="number"
              min={0}
              max={challenge.pointsToWin}
              step={1}
              value={handicap}
              disabled={loading}
              onChange={(e) => setHandicap(e.target.value)}
              className="tet-input mt-1 w-full"
            />
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              {t("challenges.handicapRecipient", { side: recipientSide })}
              {challenge.format === "DOUBLES" && t("challenges.handicapDoublesNote")}
              {" · "}
              {t("challenges.pointsToWinShort", { points: challenge.pointsToWin })}
            </span>
          </div>

          <div>
            <label htmlFor="resolve-score" className="tet-label">
              {t("challenges.scoreLabel")}
            </label>
            <input
              id="resolve-score"
              type="text"
              value={score}
              disabled={loading}
              onChange={(e) => setScore(e.target.value)}
              className="tet-input mt-1 w-full"
              placeholder={
                challenge.pointsToWin === 15
                  ? t("challenges.scorePlaceholder15")
                  : t("challenges.scorePlaceholder")
              }
              autoFocus
            />
          </div>

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="tet-btn-ghost flex-1"
              disabled={loading}
            >
              {t("challenges.resolveCancel")}
            </button>
            <button type="submit" className="tet-btn-primary flex-1" disabled={loading}>
              {loading ? (
                <Loader2 size={18} className="mx-auto animate-spin" />
              ) : (
                t("challenges.resolveSubmit")
              )}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
