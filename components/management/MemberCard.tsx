"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, Loader2, UserMinus, UserCheck } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { formatDrinkAmount } from "@/lib/constants";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorBanner from "@/components/ui/ErrorBanner";
import MemberForm from "./MemberForm";
import * as dataService from "@/lib/dataService";
import { isMemberActive } from "@/lib/memberActive";
import { useI18n } from "@/contexts/LocaleContext";
import type { MemberDTO } from "@/lib/types";

interface MemberCardProps {
  member: MemberDTO;
  onUpdated: (m: MemberDTO) => void;
  onDeleted: (id: number) => void;
}

export default function MemberCard({ member, onUpdated, onDeleted }: MemberCardProps) {
  const { t } = useI18n();
  const active = isMemberActive(member);
  const [mode, setMode] = useState<"view" | "editing" | "deleting" | "togglingActive">("view");
  const [deleting, setDeleting] = useState(false);
  const [togglingActive, setTogglingActive] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  async function handleDelete() {
    setDeleting(true);
    setActionError(null);
    try {
      await dataService.deleteMember(member.id);
      onDeleted(member.id);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete.");
      setMode("view");
    } finally {
      setDeleting(false);
    }
  }

  async function handleToggleActive() {
    setTogglingActive(true);
    setActionError(null);
    try {
      const updated = await dataService.updateMember(member.id, { isActive: !active });
      onUpdated(updated);
      setMode("view");
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : active
            ? t("management.deactivateFailed")
            : t("management.activateFailed")
      );
      setMode("view");
    } finally {
      setTogglingActive(false);
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
      <div
        className={`tet-card flex items-center gap-3 p-4 ${
          active ? "" : "opacity-70 ring-1 ring-inset ring-amber-200/80 dark:ring-amber-900/50"
        }`}
      >
        <Avatar name={member.name} avatarUrl={member.avatarUrl} size="md" />
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{member.name}</p>
            {!active && (
              <span className="shrink-0 rounded-md bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                {t("management.inactiveBadge")}
              </span>
            )}
          </div>
          {member.email && (
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{member.email}</p>
          )}
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
            onClick={() => setMode("togglingActive")}
            disabled={togglingActive}
            aria-label={
              active
                ? t("management.deactivateAria", { name: member.name })
                : t("management.activateAria", { name: member.name })
            }
            title={active ? t("management.deactivate") : t("management.activate")}
            className="tet-btn-icon"
          >
            {togglingActive ? (
              <Loader2 size={16} className="animate-spin" />
            ) : active ? (
              <UserMinus size={16} />
            ) : (
              <UserCheck size={16} />
            )}
          </button>
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

      {actionError && (
        <ErrorBanner message={actionError} onRetry={() => setActionError(null)} />
      )}

      <ConfirmDialog
        open={mode === "deleting"}
        title="Delete Member"
        message={`Remove "${member.name}" from the team? This cannot be undone.`}
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setMode("view")}
      />

      <ConfirmDialog
        open={mode === "togglingActive"}
        title={active ? t("management.deactivateTitle") : t("management.activateTitle")}
        message={
          active
            ? t("management.deactivateConfirm", { name: member.name })
            : t("management.activateConfirm", { name: member.name })
        }
        confirmLabel={active ? t("management.deactivate") : t("management.activate")}
        danger={active}
        onConfirm={handleToggleActive}
        onCancel={() => setMode("view")}
      />
    </>
  );
}
