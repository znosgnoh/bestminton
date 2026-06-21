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
        <div className="flex flex-col items-center gap-2 text-emerald-600 dark:text-amber-400">
          <CheckCircle2 size={48} strokeWidth={1.5} />
          <p className="font-heading text-lg font-semibold">Synced to Splitwise!</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">The expense has been created successfully.</p>
        </div>
        <button onClick={onReset} className="tet-btn-ghost mt-2 w-full py-4 text-base">
          Start New Session
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {status === "error" && error && (
        <div className="tet-alert-error">{error}</div>
      )}

      {hasManualMembers && status !== "error" && (
        <div className="tet-alert-info">
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
        className="tet-btn-primary w-full py-4 text-base"
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

      <button onClick={onReset} className="tet-btn-ghost w-full py-3">
        Start New Session
      </button>
    </div>
  );
}
