"use client";

import { useState } from "react";
import Link from "next/link";
import { Pencil, Trash2, Loader2, MapPin, Users, RefreshCw, CheckCircle, ClipboardList, Copy } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorBanner from "@/components/ui/ErrorBanner";
import MatchForm from "./MatchForm";
import { useI18n } from "@/contexts/LocaleContext";
import * as dataService from "@/lib/dataService";
import {
  getShuttlecockFeePerHour,
  shouldCreateShuttlecockRemittance,
  splitSettlementFees,
} from "@/lib/shuttlecock";
import { formatAmount, getCurrencySymbol } from "@/lib/currency";
import type { MatchDTO } from "@/lib/types";

interface MatchManageRowProps {
  match: MatchDTO;
  shuttlecockFeePerHour: number;
  onUpdated: (m: MatchDTO) => void;
  onDeleted: (id: number) => void;
  onClone: (m: MatchDTO) => void;
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

export default function MatchManageRow({
  match,
  shuttlecockFeePerHour,
  onUpdated,
  onDeleted,
  onClone,
}: MatchManageRowProps) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"view" | "editing" | "deleting">("view");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const settleHref = `/matches/${match.id}?manage=1`;
  const curSym = getCurrencySymbol();

  const paidByName =
    match.registrations.find((r) => r.memberId === match.paidByMemberId)?.member.name ?? null;
  const shuttlecockRecipientName =
    match.registrations.find((r) => r.memberId === match.shuttlecockRecipientMemberId)?.member
      .name ?? null;

  const feeSplit =
    match.totalCost != null &&
    match.totalCost > 0 &&
    match.hours != null &&
    match.hours > 0
      ? splitSettlementFees(match.totalCost, match.hours, shuttlecockFeePerHour)
      : null;

  const showRemittance =
    feeSplit &&
    shouldCreateShuttlecockRemittance({
      title: match.title,
      shuttlecockFee: feeSplit.shuttlecockFee,
      paidByMemberId: match.paidByMemberId,
      shuttlecockRecipientMemberId: match.shuttlecockRecipientMemberId,
    });

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
      <div className="tet-panel">
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
      <div className="tet-card p-4">
        <div className="flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">{match.title}</p>
              {match.isRecurring && (
                <span className="tet-badge-gold shrink-0">
                  <RefreshCw size={10} />
                  Weekly
                </span>
              )}
              {match.synced && (
                <span className="tet-badge-synced shrink-0">
                  <CheckCircle size={10} />
                  Synced
                </span>
              )}
            </div>
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
              <MapPin size={11} className="text-amber-600 dark:text-amber-400" />
              {match.venue}
            </p>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-500">{formatDate(match.scheduledAt)}</p>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-gray-500 dark:text-gray-500">
              <Users size={11} />
              {headcount} {headcount === 1 ? "player" : "players"}
            </p>
            {feeSplit && paidByName && (
              <div className="mt-1.5 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                <p>
                  Paid by {paidByName}
                  {" · "}
                  Court {curSym}{formatAmount(feeSplit.courtFee)}
                  {" · "}
                  Shuttlecock {curSym}{formatAmount(feeSplit.shuttlecockFee)}
                </p>
                {showRemittance && shuttlecockRecipientName && (
                  <p className="font-medium text-emerald-700 dark:text-amber-400">
                    {paidByName} → {shuttlecockRecipientName} shuttlecock{" "}
                    {curSym}{formatAmount(feeSplit.shuttlecockFee)}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            {isPast && (
              <Link
                href={settleHref}
                className="tet-btn-icon hover:bg-emerald-50 dark:hover:bg-emerald-950 hover:text-emerald-600 dark:hover:text-amber-400"
                title="Settle match"
              >
                <ClipboardList size={16} />
              </Link>
            )}
            <button
              type="button"
              onClick={() => onClone(match)}
              className="tet-btn-icon"
              title={t("management.clone")}
            >
              <Copy size={16} />
            </button>
            <button onClick={() => setMode("editing")} className="tet-btn-icon">
              <Pencil size={16} />
            </button>
            <button
              onClick={() => setMode("deleting")}
              disabled={deleting}
              className="tet-btn-icon-danger"
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
