"use client";

import { useState } from "react";
import { Pencil, Trash2, Loader2 } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
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
      <div className="rounded-2xl border border-emerald-100 dark:border-emerald-900 bg-white dark:bg-gray-900 p-4 shadow-sm">
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
      <div className="flex items-center gap-3 rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800">
        <Avatar name={member.name} avatarUrl={member.avatarUrl} size="md" />
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{member.name}</p>
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
            {member.splitwiseId ? (
              <span className="text-emerald-600 dark:text-emerald-400">SW: {member.splitwiseId}</span>
            ) : (
              "No Splitwise ID"
            )}
          </p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button
            onClick={() => setMode("editing")}
            className="rounded-xl p-2 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 hover:text-gray-700 dark:hover:text-gray-300"
          >
            <Pencil size={16} />
          </button>
          <button
            onClick={() => setMode("deleting")}
            disabled={deleting}
            className="rounded-xl p-2 text-gray-400 hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-500 disabled:opacity-50"
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
