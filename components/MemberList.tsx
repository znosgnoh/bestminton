"use client";

import { useState } from "react";
import { UserPlus, Download } from "lucide-react";
import type { AttendanceRecord } from "@/lib/types";
import MemberRow from "./MemberRow";
import ErrorBanner from "./ui/ErrorBanner";
import LoadingSpinner from "./ui/LoadingSpinner";

interface MemberListProps {
  loading: boolean;
  error: string | null;
  attendance: AttendanceRecord[];
  paidById: number | null;
  onRetry: () => void;
  onLoadFromSplitwise: () => void;
  onAddManual: (name: string) => void;
  onRemoveManual: (id: number) => void;
  onToggle: (id: number) => void;
  onHoursChange: (id: number, v: number) => void;
  onGuestsChange: (id: number, v: number) => void;
  onSetPayer: (id: number) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function MemberList({
  loading,
  error,
  attendance,
  paidById,
  onRetry,
  onLoadFromSplitwise,
  onAddManual,
  onRemoveManual,
  onToggle,
  onHoursChange,
  onGuestsChange,
  onSetPayer,
  onNext,
  onBack,
}: MemberListProps) {
  const [newName, setNewName] = useState("");

  const presentMembers = attendance.filter((r) => r.present);
  const allHoursValid = presentMembers.every((r) => r.hours > 0);
  const payerSelected = paidById !== null && presentMembers.some((r) => r.memberId === paidById);
  const canReview = presentMembers.length > 0 && allHoursValid && payerSelected;

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = newName.trim();
    if (trimmed) {
      onAddManual(trimmed);
      setNewName("");
    }
  }

  return (
    <div className="space-y-4">
      {/* Splitwise loader */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onLoadFromSplitwise}
          disabled={loading}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? (
            <LoadingSpinner size={14} />
          ) : (
            <Download size={14} />
          )}
          Load from Splitwise
        </button>
        <span className="text-xs text-gray-400">or add manually below</span>
      </div>

      {error && <ErrorBanner message={error} onRetry={onRetry} />}

      {/* Manual add form */}
      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          placeholder="Member name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="flex-1 rounded-xl border border-gray-300 px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-40"
        >
          <UserPlus size={14} />
          Add
        </button>
      </form>

      {/* Member rows */}
      {attendance.length > 0 && (
        <div className="space-y-3">
          {attendance.map((record) => (
            <MemberRow
              key={record.memberId}
              record={record}
              isPayer={record.memberId === paidById}
              onToggle={() => onToggle(record.memberId)}
              onHoursChange={(v) => onHoursChange(record.memberId, v)}
              onGuestsChange={(v) => onGuestsChange(record.memberId, v)}
              onSetPayer={() => onSetPayer(record.memberId)}
              onRemove={record.isManual ? () => onRemoveManual(record.memberId) : undefined}
            />
          ))}
        </div>
      )}

      {/* Payer validation hint */}
      {presentMembers.length > 0 && !payerSelected && (
        <p className="text-center text-sm text-amber-600">
          Select who paid by tapping the ★ next to their name.
        </p>
      )}
      {presentMembers.length === 0 && (
        <p className="text-center text-sm text-gray-400">
          Add or check at least one participant.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button
          onClick={onBack}
          className="flex-1 rounded-xl border border-gray-300 py-4 text-base font-medium text-gray-700 transition hover:bg-gray-50 active:bg-gray-100"
        >
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canReview}
          className="flex-2 rounded-xl bg-emerald-600 py-4 text-base font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Review Split
        </button>
      </div>
    </div>
  );
}
