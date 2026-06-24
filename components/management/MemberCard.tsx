"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { formatDrinkAmount } from "@/lib/constants";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorBanner from "@/components/ui/ErrorBanner";
import MemberForm from "./MemberForm";
import * as dataService from "@/lib/dataService";
import type { MemberDTO } from "@/lib/types";

interface MemberCardProps {
  member: MemberDTO;
  onUpdated: (m: MemberDTO) => void;
  onDeleted: (id: number) => void;
}

export default function MemberCard({ member, onUpdated, onDeleted }: MemberCardProps) {
  const [mode, setMode] = useState<"view" | "editing" | "deleting">("view");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await dataService.deleteMember(member.id);
      onDeleted(member.id);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Failed to delete.");
      setMode("view");
    } finally {
      setDeleting(false);
    }
  }

  if (mode === "editing") {
    return (
      <div className="tet-panel">
        <MemberForm
          initial={member}
          onSaved={(m) => {
            onUpdated(m);
            setMode("view");
          }}
          onCancel={() => setMode("view")}
        />
      </div>
    );
  }

  return (
    <>
      <div className="tet-card flex items-center gap-3 p-4">
        <Avatar name={member.name} avatarUrl={member.avatarUrl} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{member.name}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {member.splitwiseId ? (
              <span className="text-emerald-600 dark:text-amber-400">SW: {member.splitwiseId}</span>
            ) : (
              "No Splitwise ID"
            )}
            <span className="mx-1.5">·</span>
            <span>{member.eloRating} Elo</span>
            <span className="mx-1.5">·</span>
            <span className="inline-flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
              <OrangeJuiceIcon size={12} className="text-orange-500 dark:text-orange-400 shrink-0" />
              {member.debtSummary.totalOwed > 0 && (
                <span className="text-red-600 dark:text-red-400">
                  Owes {formatDrinkAmount(member.debtSummary.totalOwed)}
                </span>
              )}
              {member.debtSummary.totalOwing > 0 && (
                <span className="text-emerald-600 dark:text-emerald-400">
                  Owed {formatDrinkAmount(member.debtSummary.totalOwing)}
                </span>
              )}
              {member.debtSummary.totalOwed === 0 && member.debtSummary.totalOwing === 0 && (
                <span>Even</span>
              )}
              {(member.debtSummary.totalOwed > 0 || member.debtSummary.totalOwing > 0) && (
                <>
                  <span className="mx-1.5">·</span>
                  <Link
                    href={`/cam?member=${member.id}`}
                    className="text-orange-600 hover:text-orange-700 dark:text-orange-400 dark:hover:text-orange-300 underline-offset-2 hover:underline"
                  >
                    Settle
                  </Link>
                </>
              )}
            </span>
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setMode("editing")}
            aria-label={`Edit ${member.name}`}
            className="tet-btn-icon"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => setMode("deleting")}
            disabled={deleting}
            aria-label={`Delete ${member.name}`}
            className="tet-btn-icon-danger"
          >
            {deleting ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        </div>
      </div>

      {deleteError && (
        <ErrorBanner message={deleteError} onRetry={() => setDeleteError(null)} />
      )}

      <ConfirmDialog
        open={mode === "deleting"}
        title="Delete Member"
        message={`Remove "${member.name}" from the team? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setMode("view")}
      />
    </>
  );
}
