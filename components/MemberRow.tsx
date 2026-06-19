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
      className={`rounded-xl border p-4 transition ${
        record.present ? "border-emerald-300 bg-emerald-50" : "border-gray-200 bg-white"
      }`}
    >
      {/* Name row */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={record.present}
          onChange={onToggle}
          className="h-5 w-5 shrink-0 rounded accent-emerald-600"
        />
        <span className="flex-1 text-base font-medium text-gray-800">
          {record.firstName} {record.lastName}
        </span>

        {/* Payer star — only shown when member is present */}
        {record.present && (
          <button
            type="button"
            onClick={onSetPayer}
            title={isPayer ? "Payer" : "Set as payer"}
            className={`rounded-full p-1 transition ${
              isPayer
                ? "text-amber-500"
                : "text-gray-300 hover:text-amber-400"
            }`}
          >
            <Star size={18} fill={isPayer ? "currentColor" : "none"} />
          </button>
        )}

        {/* Remove button — only for manually added members */}
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            title="Remove member"
            className="rounded-full p-1 text-gray-300 transition hover:text-red-400"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {isPayer && record.present && (
        <p className="mt-1 pl-7 text-xs font-medium text-amber-600">Paid by</p>
      )}

      {/* Hours + Guests inputs */}
      {record.present && (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Hours played
            </label>
            <input
              type="number"
              inputMode="decimal"
              min="0.5"
              step="0.5"
              value={record.hours || ""}
              onChange={(e) => onHoursChange(parseFloat(e.target.value) || 0)}
              placeholder="e.g. 1.5"
              className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${
                hoursError ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
              }`}
            />
            {hoursError && (
              <p className="mt-0.5 text-xs text-red-600">{hoursError}</p>
            )}
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-gray-500">
              Guests (+1 each)
            </label>
            <input
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              value={record.guests}
              onChange={(e) =>
                onGuestsChange(Math.max(0, parseInt(e.target.value) || 0))
              }
              className={`w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500 ${
                guestsError ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
              }`}
            />
            {guestsError && (
              <p className="mt-0.5 text-xs text-red-600">{guestsError}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
