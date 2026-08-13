"use client";

import { Loader2 } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";
import type { PointsToWin } from "@/lib/elo";

interface PointsToWinToggleProps {
  value: PointsToWin;
  onChange: (next: PointsToWin) => void;
  disabled?: boolean;
  loading?: boolean;
}

export default function PointsToWinToggle({
  value,
  onChange,
  disabled = false,
  loading = false,
}: PointsToWinToggleProps) {
  const { t } = useI18n();
  const is15 = value === 15;
  const isDisabled = disabled || loading;

  return (
    <div className="flex items-center justify-center gap-3">
      <span
        className={`text-sm tabular-nums ${
          value === 21
            ? "font-semibold text-gray-900 dark:text-gray-100"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {t("challenges.pointsToWin21")}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={is15}
        aria-label={t("challenges.pointsToWinLabel")}
        disabled={isDisabled}
        onClick={() => onChange(is15 ? 21 : 15)}
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-amber-500 disabled:cursor-not-allowed disabled:opacity-60 ${
          is15 ? "bg-emerald-600 dark:bg-emerald-500" : "bg-gray-300 dark:bg-gray-600"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform ${
            is15 ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <span
        className={`text-sm tabular-nums ${
          is15
            ? "font-semibold text-gray-900 dark:text-gray-100"
            : "text-gray-500 dark:text-gray-400"
        }`}
      >
        {t("challenges.pointsToWin15")}
      </span>
      {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
    </div>
  );
}
