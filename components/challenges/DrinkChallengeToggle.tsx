"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { DRINK_CHALLENGE_LABEL } from "@/lib/constants";
import * as dataService from "@/lib/dataService";
import type { ChallengeDTO } from "@/lib/types";

interface DrinkChallengeToggleProps {
  challenge: ChallengeDTO;
  onUpdated: (challenge: ChallengeDTO) => void;
}

export default function DrinkChallengeToggle({
  challenge,
  onUpdated,
}: DrinkChallengeToggleProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (challenge.status !== "PENDING") return null;

  async function handleToggle(checked: boolean) {
    setLoading(true);
    setError(null);

    try {
      const updated = await dataService.updateChallenge(challenge.id, {
        isDrinkChallenge: checked,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update setting.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="tet-card p-4 space-y-2">
      <label className="flex cursor-pointer items-start gap-3">
        <input
          type="checkbox"
          checked={challenge.isDrinkChallenge}
          disabled={loading}
          onChange={(e) => void handleToggle(e.target.checked)}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
        />
        <span className="flex-1">
          <span className="flex items-center gap-1.5 text-sm font-medium text-gray-900 dark:text-gray-100">
            <OrangeJuiceIcon size={16} className="text-orange-500 dark:text-orange-400" />
            {DRINK_CHALLENGE_LABEL}
            {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
          </span>
          <span className="mt-0.5 block text-xs text-gray-500 dark:text-gray-400">
            {challenge.format === "DOUBLES"
              ? "Mỗi người thắng được 1 ly nước cam từ phe thua (không ghép cố định) — trừ khi có cược, khi đó chỉ áp dụng cược."
              : "Người thua mua 1 ly nước cam cho người thắng khi chốt kèo — trừ khi có cược, khi đó chỉ áp dụng cược."}
          </span>
        </span>
      </label>
      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
    </div>
  );
}
