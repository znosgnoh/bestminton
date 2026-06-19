"use client";

import { CheckCircle2, RefreshCw, Send, Info } from "lucide-react";
import type { SyncStatus } from "@/lib/types";
import LoadingSpinner from "./ui/LoadingSpinner";

interface SyncButtonProps {
  status: SyncStatus;
  error: string | null;
  canSync: boolean;
  hasManualMembers: boolean;
  onClick: () => void;
  onReset: () => void;
}

export default function SyncButton({
  status,
  error,
  canSync,
  hasManualMembers,
  onClick,
  onReset,
}: SyncButtonProps) {
  if (status === "success") {
    return (
      <div className="space-y-3 text-center">
        <div className="flex flex-col items-center gap-2 text-emerald-600">
          <CheckCircle2 size={48} strokeWidth={1.5} />
          <p className="text-lg font-semibold">Synced to Splitwise!</p>
          <p className="text-sm text-gray-500">The expense has been created successfully.</p>
        </div>
        <button
          onClick={onReset}
          className="mt-2 w-full rounded-xl border border-gray-300 py-4 text-base font-medium text-gray-700 transition hover:bg-gray-50 active:bg-gray-100"
        >
          Start New Session
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Error from a failed sync attempt */}
      {status === "error" && error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {/* Informational notice when manual members are present */}
      {hasManualMembers && status !== "error" && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <Info size={16} className="mt-0.5 shrink-0" />
          <span>
            Manually-added members don&apos;t have Splitwise IDs. Load members from
            Splitwise to enable syncing, or use the split summary above for manual
            settlement.
          </span>
        </div>
      )}

      <button
        onClick={onClick}
        disabled={!canSync || status === "syncing"}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 text-base font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {status === "syncing" ? (
          <>
            <LoadingSpinner size={18} className="text-white" />
            Syncing…
          </>
        ) : (
          <>
            {status === "error" ? <RefreshCw size={18} /> : <Send size={18} />}
            {status === "error" ? "Retry Sync" : "Sync to Splitwise"}
          </>
        )}
      </button>

      <button
        onClick={onReset}
        className="w-full rounded-xl border border-gray-200 py-3 text-sm font-medium text-gray-500 transition hover:bg-gray-50"
      >
        Start New Session
      </button>
    </div>
  );
}
