"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { suggestedHandicap } from "@/lib/elo";
import * as dataService from "@/lib/dataService";
import type { ChallengeDTO } from "@/lib/types";

interface HandicapEditorProps {
  challenge: ChallengeDTO;
  onUpdated: (challenge: ChallengeDTO) => void;
}

export default function HandicapEditor({ challenge, onUpdated }: HandicapEditorProps) {
  const [value, setValue] = useState(String(challenge.handicapPoints));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const suggested = useMemo(
    () => suggestedHandicap(challenge.sideA.averageElo, challenge.sideB.averageElo),
    [challenge.sideA.averageElo, challenge.sideB.averageElo]
  );

  const recipientSide = challenge.handicapRecipientSide;

  useEffect(() => {
    setValue(String(challenge.handicapPoints));
  }, [challenge.handicapPoints]);

  if (challenge.status !== "PENDING") return null;

  async function save(next: number) {
    if (next === challenge.handicapPoints) return;

    setLoading(true);
    setError(null);

    try {
      const updated = await dataService.updateChallenge(challenge.id, {
        handicapPoints: next,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được chấp điểm.");
      setValue(String(challenge.handicapPoints));
    } finally {
      setLoading(false);
    }
  }

  function handleBlur() {
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed) || parsed < 0) {
      setValue(String(challenge.handicapPoints));
      return;
    }
    void save(parsed);
  }

  return (
    <div className="tet-card p-4 space-y-2">
      <label className="block">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          Chấp điểm
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </span>
        <input
          type="number"
          min={0}
          max={21}
          step={1}
          value={value}
          disabled={loading}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          className="tet-input mt-2 w-full"
        />
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          Gợi ý: {suggested} điểm cho Side {recipientSide}
          {challenge.format === "DOUBLES" && " (Elo trung bình thấp hơn)"}
          {" · "}Có thể chỉnh trước khi bắt đầu kèo
        </span>
      </label>
      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
    </div>
  );
}
