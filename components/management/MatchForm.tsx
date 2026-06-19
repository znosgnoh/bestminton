"use client";

import { useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import * as dataService from "@/lib/dataService";
import type { MatchDTO } from "@/lib/types";

interface MatchFormProps {
  initial?: MatchDTO;
  onSaved: (matches: MatchDTO[]) => void;
  onCancel?: () => void;
}

const DAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
];

function toInputDate(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function toInputTime(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export default function MatchForm({ initial, onSaved, onCancel }: MatchFormProps) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [venue, setVenue] = useState(initial?.venue ?? "");
  const [date, setDate] = useState(initial ? toInputDate(initial.scheduledAt) : "");
  const [time, setTime] = useState(initial ? toInputTime(initial.scheduledAt) : "20:00");
  const [isRecurring, setIsRecurring] = useState(initial?.isRecurring ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const dayName =
    date ? DAY_NAMES[new Date(`${date}T00:00`).getDay()] : "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    if (!venue.trim()) { setError("Venue is required."); return; }
    if (!date) { setError("Date is required."); return; }
    if (!time) { setError("Time is required."); return; }

    const scheduledAt = new Date(`${date}T${time}`).toISOString();

    setSaving(true);
    setError(null);
    try {
      if (initial) {
        const updated = await dataService.updateMatchInfo(initial.id, {
          title: title.trim(),
          venue: venue.trim(),
          scheduledAt,
        });
        onSaved([updated]);
      } else {
        const created = await dataService.createMatches({
          title: title.trim(),
          venue: venue.trim(),
          scheduledAt,
          isRecurring,
        });
        onSaved(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls =
    "w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-3 py-2.5 text-sm text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900";

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Title <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Tuesday Night Bminton"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Venue <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={venue}
          onChange={(e) => setVenue(e.target.value)}
          placeholder="e.g. Sports Complex Court 3"
          className={inputCls}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Date <span className="text-red-500">*</span>
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={inputCls}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
            Time <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className={inputCls}
          />
        </div>
      </div>

      {!initial && (
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={isRecurring}
            onChange={(e) => setIsRecurring(e.target.checked)}
            className="h-4 w-4 rounded border-gray-300 dark:border-gray-600 text-emerald-600 focus:ring-emerald-500"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300 flex items-center gap-1.5">
            <RefreshCw size={13} className="text-gray-400" />
            Repeat weekly (creates 4 sessions)
          </span>
        </label>
      )}

      {isRecurring && dayName && (
        <p className="rounded-xl bg-blue-50 dark:bg-blue-950 px-3 py-2 text-xs text-blue-700 dark:text-blue-300">
          Will repeat every <strong>{dayName}</strong> for 4 weeks.
        </p>
      )}

      {error && (
        <p className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-3 py-2 text-xs text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 py-2.5 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800"
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving}
          className="flex-1 rounded-xl bg-emerald-600 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={14} className="animate-spin" />}
          {saving
            ? "Saving…"
            : initial
            ? "Save Changes"
            : isRecurring
            ? "Create 4 Sessions"
            : "Create Match"}
        </button>
      </div>
    </form>
  );
}
