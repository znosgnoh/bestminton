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
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onLoadFromSplitwise}
          disabled={loading}
          className="tet-btn-ghost border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm disabled:opacity-50"
        >
          {loading ? (
            <LoadingSpinner size={14} />
          ) : (
            <Download size={14} />
          )}
          Load from Splitwise
        </button>
        <span className="text-xs text-gray-500 dark:text-gray-500">or add manually below</span>
      </div>

      {error && <ErrorBanner message={error} onRetry={onRetry} />}

      <form onSubmit={handleAdd} className="flex gap-2">
        <input
          type="text"
          placeholder="Member name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="tet-input flex-1"
        />
        <button
          type="submit"
          disabled={!newName.trim()}
          className="tet-btn-primary px-4 disabled:opacity-40"
        >
          <UserPlus size={14} />
          Add
        </button>
      </form>

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

      {presentMembers.length > 0 && !payerSelected && (
        <p className="text-center text-sm text-amber-700 dark:text-amber-400">
          Select who paid by tapping the ★ next to their name.
        </p>
      )}
      {presentMembers.length === 0 && (
        <p className="text-center text-sm text-gray-500 dark:text-gray-500">
          Add or check at least one participant.
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <button onClick={onBack} className="tet-btn-ghost flex-1 py-4 text-base">
          Back
        </button>
        <button
          onClick={onNext}
          disabled={!canReview}
          className="tet-btn-primary flex-2 py-4 text-base disabled:opacity-40"
        >
          Review Split
        </button>
      </div>
    </div>
  );
}
