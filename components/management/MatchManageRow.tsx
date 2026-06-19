"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, Loader2, MapPin, Users, RefreshCw, CheckCircle, ClipboardList } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorBanner from "@/components/ui/ErrorBanner";
import MatchForm from "./MatchForm";
import * as dataService from "@/lib/dataService";
import type { MatchDTO } from "@/lib/types";

interface MatchManageRowProps {
  match: MatchDTO;
  onUpdated: (m: MatchDTO) => void;
  onDeleted: (id: number) => void;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function totalHeadcount(match: MatchDTO): number {
  return match.registrations.reduce((sum, r) => sum + 1 + r.guests.length, 0);
}

export default function MatchManageRow({ match, onUpdated, onDeleted }: MatchManageRowProps) {
  const [mode, setMode] = useState<"view" | "editing" | "deleting">("view");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await dataService.deleteMatch(match.id, match.synced);
      onDeleted(match.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete.");
      setMode("view");
    } finally {
      setDeleting(false);
    }
  }

  if (mode === "editing") {
    return (
      <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 bg-white dark:bg-gray-900 p-4 shadow-sm">
        <MatchForm
          initial={match}
          onSaved={([updated]) => {
            onUpdated(updated);
            setMode("view");
          }}
          onCancel={() => setMode("view")}
        />
      </div>
    );
  }

  const headcount = totalHeadcount(match);
  const isPast = new Date(match.scheduledAt) < new Date();

  return (
    <>
      <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{match.title}</p>
              {match.isRecurring && (
                <span className="flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/40 px-2 py-0.5 text-xs font-medium text-blue-700 dark:text-blue-300 shrink-0">
                  <RefreshCw size={10} />
                  Weekly
                </span>
              )}
              {match.synced && (
                <span className="flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-900/40 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300 shrink-0">
                  <CheckCircle size={10} />
                  Synced
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400">
              <MapPin size={11} />
              {match.venue}
            </p>
            <p className="mt-0.5 text-xs text-gray-400 dark:text-gray-500">{formatDate(match.scheduledAt)}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Users size={11} />
              {headcount} {headcount === 1 ? "player" : "players"}
            </p>
          </div>
          <div className="flex gap-1 shrink-0">
            {isPast && (
              <Link
                href={`/matches/${match.id}?manage=1`}
                className="rounded-xl p-2 text-gray-400 hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600 dark:hover:text-emerald-400"
                title="Settle match"
              >
                <ClipboardList size={16} />
              </Link>
            )}
            <button
              onClick={() => setMode("editing")}
              className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => setMode("deleting")}
              disabled={deleting}
              className="rounded-xl p-2 text-gray-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 disabled:opacity-50"
            >
              {deleting ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Trash2 size={16} />
              )}
            </button>
          </div>
        </div>
      </div>

      {deleteError && (
        <ErrorBanner message={deleteError} onRetry={() => setDeleteError(null)} />
      )}

      <ConfirmDialog
        open={mode === "deleting"}
        title="Delete Match"
        message={
          match.synced
            ? `"${match.title}" has been synced to Splitwise. Deleting it will only remove it locally. Continue?`
            : `Delete "${match.title}"? Registered players will also be removed.`
        }
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setMode("view")}
      />
    </>
  );
}
