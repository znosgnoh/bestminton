"use client";

import { useState } from "react";
import ErrorBanner from "@/components/ui/ErrorBanner";
import PointsToWinToggle from "@/components/challenges/PointsToWinToggle";
import { useI18n } from "@/contexts/LocaleContext";
import { isPointsToWin, type PointsToWin } from "@/lib/elo";
import * as dataService from "@/lib/dataService";
import type { ChallengeDTO } from "@/lib/types";

interface PointsToWinEditorProps {
  challenge: ChallengeDTO;
  onUpdated: (challenge: ChallengeDTO) => void;
}

export default function PointsToWinEditor({ challenge, onUpdated }: PointsToWinEditorProps) {
  const { t } = useI18n();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (challenge.status !== "PENDING") return null;

  const value: PointsToWin = isPointsToWin(challenge.pointsToWin) ? challenge.pointsToWin : 21;

  async function handleChange(next: PointsToWin) {
    if (next === value || loading) return;

    setLoading(true);
    setError(null);

    try {
      const updated = await dataService.updateChallenge(challenge.id, {
        pointsToWin: next,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("challenges.pointsToWinFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tet-card p-4 space-y-2">
      <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
        {t("challenges.pointsToWinLabel")}
      </p>
      <PointsToWinToggle value={value} onChange={(next) => void handleChange(next)} loading={loading} />
      <p className="text-xs text-gray-500 dark:text-gray-400">{t("challenges.pointsToWinHint")}</p>
      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
    </div>
  );
}
