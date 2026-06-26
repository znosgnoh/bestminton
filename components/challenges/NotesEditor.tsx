"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import ErrorBanner from "@/components/ui/ErrorBanner";
import * as dataService from "@/lib/dataService";
import type { ChallengeDTO } from "@/lib/types";

interface NotesEditorProps {
  challenge: ChallengeDTO;
  onUpdated: (challenge: ChallengeDTO) => void;
}

export default function NotesEditor({ challenge, onUpdated }: NotesEditorProps) {
  const [value, setValue] = useState(challenge.notes ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isPending = challenge.status === "PENDING";
  const hasNotes = Boolean(challenge.notes?.trim());

  useEffect(() => {
    setValue(challenge.notes ?? "");
  }, [challenge.notes]);

  if (!isPending && !hasNotes) return null;

  async function save(next: string) {
    const normalized = next.trim() || null;
    const current = challenge.notes?.trim() || null;
    if (normalized === current) return;

    setLoading(true);
    setError(null);

    try {
      const updated = await dataService.updateChallenge(challenge.id, {
        notes: normalized,
      });
      onUpdated(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không cập nhật được ghi chú.");
      setValue(challenge.notes ?? "");
    } finally {
      setLoading(false);
    }
  }

  function handleBlur() {
    if (!isPending) return;
    void save(value);
  }

  if (!isPending) {
    return (
      <div className="tet-card p-4 space-y-2">
        <p className="text-sm font-medium text-gray-900 dark:text-gray-100">Ghi chú</p>
        <p className="whitespace-pre-wrap text-sm text-gray-600 dark:text-gray-300">
          {challenge.notes}
        </p>
      </div>
    );
  }

  return (
    <div className="tet-card p-4 space-y-2">
      <label className="block">
        <span className="flex items-center gap-2 text-sm font-medium text-gray-900 dark:text-gray-100">
          Ghi chú
          {loading && <Loader2 size={14} className="animate-spin text-gray-400" />}
        </span>
        <textarea
          rows={3}
          value={value}
          disabled={loading}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleBlur}
          placeholder="Luật riêng, thông tin thêm…"
          className="tet-input mt-2 w-full resize-y min-h-[4.5rem]"
        />
        <span className="mt-1 block text-xs text-gray-500 dark:text-gray-400">
          Có thể chỉnh trước khi bắt đầu kèo
        </span>
      </label>
      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
    </div>
  );
}
