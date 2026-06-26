"use client";

import { useEffect, useState } from "react";
import { Loader2, Trophy } from "lucide-react";
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
  const [handicap, setHandicap] = useState(String(challenge.handicapPoints));
  const [score, setScore] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setHandicap(String(challenge.handicapPoints));
      setScore("");
      setError(null);
    }
  }, [open, challenge.handicapPoints]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsedHandicap = parseInt(handicap, 10);
    if (Number.isNaN(parsedHandicap) || parsedHandicap < 0 || parsedHandicap > 21) {
      setError("Chấp điểm phải từ 0 đến 21.");
      return;
    }
    const trimmedScore = score.trim();
    if (!trimmedScore) {
      setError("Vui lòng nhập tỷ số.");
      return;
    }
    if (trimmedScore.length > 80) {
      setError("Tỷ số quá dài (tối đa 80 ký tự).");
      return;
    }
    onSubmit(parsedHandicap, trimmedScore);
  }

  const recipientSide = challenge.handicapRecipientSide;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={loading ? undefined : onCancel}
    >
      <div
        className="tet-card w-full max-w-sm p-6 shadow-xl ring-amber-200/60 dark:ring-amber-900/40"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="tet-section-title">Xác nhận chấp điểm và tỷ số</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          Xác nhận chấp điểm và tỷ số trước khi chốt kèo — Side{" "}
          <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 dark:text-emerald-400">
            <Trophy size={14} />
            {winnerSide}
          </span>{" "}
          thắng.
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="resolve-handicap" className="tet-label">
              Chấp điểm
            </label>
            <input
              id="resolve-handicap"
              type="number"
              min={0}
              max={21}
              step={1}
              value={handicap}
              disabled={loading}
              onChange={(e) => setHandicap(e.target.value)}
              className="tet-input mt-1 w-full"
            />
            <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
              Side {recipientSide} được chấp
              {challenge.format === "DOUBLES" && " (Elo trung bình thấp hơn)"}
            </span>
          </div>

          <div>
            <label htmlFor="resolve-score" className="tet-label">
              Tỷ số
            </label>
            <input
              id="resolve-score"
              type="text"
              value={score}
              disabled={loading}
              onChange={(e) => setScore(e.target.value)}
              className="tet-input mt-1 w-full"
              placeholder="VD: 21-15, 21-18 hoặc 2-1"
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
              Hủy
            </button>
            <button type="submit" className="tet-btn-primary flex-1" disabled={loading}>
              {loading ? (
                <Loader2 size={18} className="mx-auto animate-spin" />
              ) : (
                "Chốt kèo"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
