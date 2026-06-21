"use client";

import { Star, X } from "lucide-react";
import type { AttendanceRecord } from "@/lib/types";

interface MemberRowProps {
  record: AttendanceRecord;
  isPayer: boolean;
  onToggle: () => void;
  onHoursChange: (v: number) => void;
  onGuestsChange: (v: number) => void;
  onSetPayer: () => void;
  onRemove?: () => void;
}

export default function MemberRow({
  record,
  isPayer,
  onToggle,
  onHoursChange,
  onGuestsChange,
  onSetPayer,
  onRemove,
}: MemberRowProps) {
  const hoursError = record.present && record.hours <= 0 ? "Required" : null;
  const guestsError =
    record.present && (!Number.isInteger(record.guests) || record.guests < 0)
      ? "Must be ≥ 0"
      : null;

  return (
    <div
      className={`rounded-xl border p-4 transition-colors duration-200 ${
        record.present
          ? "border-emerald-200/70 dark:border-emerald-900/50 bg-emerald-50/60 dark:bg-emerald-950/30"
          : "tet-card border-amber-200/40 dark:border-gray-800"
      }`}
    >
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={record.present}
          onChange={onToggle}
          className="h-5 w-5 shrink-0 rounded accent-emerald-600"
        />
        <span className="flex-1 text-base font-medium text-gray-900 dark:text-gray-100">
          {record.firstName} {record.lastName}
        </span>

        {record.present && (
          <button
            type="button"
            onClick={onSetPayer}
            title={isPayer ? "Payer" : "Set as payer"}
            className={`cursor-pointer rounded-full p-1 transition-colors duration-200 ${
              isPayer ? "text-amber-500" : "text-gray-400 hover:text-amber-400"
            }`}
          >
            <Star size={18} fill={isPayer ? "currentColor" : "none"} />
          </button>
        )}

        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Remove member"
            className="cursor-pointer rounded-full p-1 text-gray-400 transition-colors duration-200 hover:text-red-400"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isPayer && record.present && (
        <p className="mt-1 pl-7 text-xs font-medium text-amber-600 dark:text-amber-400">Paid by</p>
      )}

      {record.present && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="tet-label">Hours played</label>
            <input
              type="number"
              inputMode="decimal"
              min="0.5"
              step="0.5"
              value={record.hours || ""}
              onChange={(e) => onHoursChange(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 1.5"
              className={`tet-input ${
                hoursError ? "border-red-400 bg-red-50 dark:bg-red-950/40" : ""
              }`}
            />
            {hoursError && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{hoursError}</p>
            )}
          </div>

          <div>
            <label className="tet-label">Guests (+1 each)</label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={record.guests}
              onChange={(e) =>
                onGuestsChange(Math.max(0, parseInt(e.target.value) || 0))
              }
              className={`tet-input ${
                guestsError ? "border-red-400 bg-red-50 dark:bg-red-950/40" : ""
              }`}
            />
            {guestsError && (
              <p className="mt-0.5 text-xs text-red-600 dark:text-red-400">{guestsError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
