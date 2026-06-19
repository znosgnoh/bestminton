"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import * as dataService from "@/lib/dataService";
import type { MemberDTO } from "@/lib/types";

interface MemberFormProps {
  initial?: MemberDTO;
  onSaved: (m: MemberDTO) => void;
  onCancel?: () => void;
}

export default function MemberForm({ initial, onSaved, onCancel }: MemberFormProps) {
  const [name, setName] = useState(initial?.name ?? "");
  const [avatarUrl, setAvatarUrl] = useState(initial?.avatarUrl ?? "");
  const [splitwiseIdStr, setSplitiwseIdStr] = useState(
    initial?.splitwiseId?.toString() ?? ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required.");
      return;
    }
    const splitwiseId = splitwiseIdStr ? Number(splitwiseIdStr) : null;
    if (splitwiseIdStr && (!Number.isInteger(splitwiseId) || splitwiseId! <= 0)) {
      setError("Splitwise ID must be a positive integer.");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), avatarUrl: avatarUrl.trim() || null, splitwiseId: splitwiseId ?? null };
      const saved = initial
        ? await dataService.updateMember(initial.id, payload)
        : await dataService.createMember(payload);
      onSaved(saved);
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
          Name <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Alice"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Avatar URL (optional)
        </label>
        <input
          type="url"
          value={avatarUrl}
          onChange={(e) => setAvatarUrl(e.target.value)}
          placeholder="https://…"
          className={inputCls}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
          Splitwise ID (optional)
        </label>
        <input
          type="number"
          min="1"
          step="1"
          value={splitwiseIdStr}
          onChange={(e) => setSplitiwseIdStr(e.target.value)}
          placeholder="e.g. 1234567"
          className={inputCls}
        />
      </div>

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
          {saving ? "Saving…" : initial ? "Save Changes" : "Add Member"}
        </button>
      </div>
    </form>
  );
}
