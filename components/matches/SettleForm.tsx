"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Loader2, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { calculateShares } from "@/lib/calculations";
import { currencyLabel, formatAmount, getCurrencySymbol } from "@/lib/currency";
import * as dataService from "@/lib/dataService";
import type { MatchDTO, RegistrationDTO, CalculatedShare } from "@/lib/types";

interface SettleFormProps {
  match: MatchDTO;
  registrations: RegistrationDTO[];
  splitwiseConfigured: boolean;
  currencyCode: string;
}

export default function SettleForm({ match, registrations, splitwiseConfigured, currencyCode }: SettleFormProps) {
  const [totalCost, setTotalCost] = useState<number | "">(match.totalCost ?? "");
  const [hours, setHours] = useState<number | "">(match.hours ?? "");
  const [paidByMemberId, setPaidByMemberId] = useState<number | null>(match.paidByMemberId);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(match.totalCost !== null && match.hours !== null);
  const [synced, setSynced] = useState(match.synced);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return; }
    setSavedOk(false);
  }, [registrations]);
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "success" | "error">("idle");
  const [syncError, setSyncError] = useState<string | null>(null);

  const shares: CalculatedShare[] = useMemo(() => {
    if (
      typeof totalCost !== "number" ||
      typeof hours !== "number" ||
      totalCost <= 0 ||
      hours <= 0 ||
      !registrations.length
    )
      return [];
    return calculateShares(registrations, totalCost, hours);
  }, [totalCost, hours, registrations]);

  const missingSplitwiseIds = registrations
    .filter((r) => !r.member.splitwiseId)
    .map((r) => r.member.name);

  const canSync =
    splitwiseConfigured &&
    shares.length > 0 &&
    paidByMemberId !== null &&
    missingSplitwiseIds.length === 0 &&
    savedOk &&
    !synced &&
    syncStatus !== "syncing";

  async function handleSave() {
    if (typeof totalCost !== "number" || totalCost <= 0) {
      setSaveError("Total cost must be a positive number.");
      return;
    }
    if (typeof hours !== "number" || hours <= 0) {
      setSaveError("Hours played must be a positive number.");
      return;
    }
    if (!paidByMemberId) {
      setSaveError("Please select who paid.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await dataService.saveMatchSettlement(match.id, {
        totalCost: totalCost as number,
        hours: hours as number,
        paidByMemberId: paidByMemberId as number,
      });
      setSavedOk(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSync() {
    if (!canSync || typeof totalCost !== "number") return;
    const paidByReg = registrations.find((r) => r.memberId === paidByMemberId);
    if (!paidByReg?.member.splitwiseId) return;

    setSyncStatus("syncing");
    setSyncError(null);
    try {
      const res = await fetch("/api/splitwise/expense", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          matchId: match.id,
          totalCost,
          description: match.title,
          date: match.scheduledAt,
          details: match.venue ? `Venue: ${match.venue}` : undefined,
          groupId: 0,
          paidById: paidByReg.member.splitwiseId,
          participants: shares.map((s) => {
            const reg = registrations.find((r) => r.memberId === s.memberId);
            return { userId: reg!.member.splitwiseId!, owedShare: s.owedShare };
          }),
        }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Sync failed.");
      setSyncStatus("success");
      setSynced(true);
    } catch (err) {
      setSyncStatus("error");
      setSyncError(err instanceof Error ? err.message : "Sync failed.");
    }
  }

  const inputCls = "tet-input-lg";

  const cur = currencyLabel(currencyCode);
  const curSym = getCurrencySymbol(currencyCode);

  return (
    <div className="tet-card p-5 space-y-5">
      <h2 className="tet-section-title">Settle Match</h2>

      <div className="space-y-3">
        <div>
          <label className="tet-label text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Total Court Cost ({cur})
          </label>
          <input
            type="number" min="0" step="1" value={totalCost}
            onChange={(e) => { const v = parseFloat(e.target.value); setTotalCost(isNaN(v) ? "" : v); setSavedOk(false); }}
            className={inputCls} placeholder="e.g. 800"
          />
        </div>

        <div>
          <label className="tet-label text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Hours Played
          </label>
          <input
            type="number" min="0" step="0.5" value={hours}
            onChange={(e) => { const v = parseFloat(e.target.value); setHours(isNaN(v) ? "" : v); setSavedOk(false); }}
            className={inputCls} placeholder="e.g. 2"
          />
        </div>

        <div>
          <label className="tet-label text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paid By</label>
          <select
            value={paidByMemberId ?? ""}
            onChange={(e) => { setPaidByMemberId(e.target.value ? Number(e.target.value) : null); setSavedOk(false); }}
            className={inputCls}
          >
            <option value="">— Select —</option>
            {registrations.map((r) => (
              <option key={r.memberId} value={r.memberId}>{r.member.name}</option>
            ))}
          </select>
        </div>

        {saveError && (
          <p className="tet-alert-error">
            {saveError}
          </p>
        )}

        <button
          onClick={handleSave} disabled={saving}
          className="tet-btn-primary-lg"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? "Saving…" : "Save Settlement Data"}
        </button>
      </div>

      {shares.length > 0 && (
        <div className="space-y-3">
          <h3 className="tet-section-title text-sm">Cost Split Preview</h3>
          <div className="overflow-x-auto rounded-xl border border-amber-200/50 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-50/80 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400">
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-center">Time</th>
                  <th className="px-3 py-2 text-center">+Guests</th>
                  <th className="px-3 py-2 text-right">Owes ({curSym})</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100/50 dark:divide-gray-800">
                {shares.map((s) => {
                  const guestLabel =
                    s.guestCount === 0
                      ? "—"
                      : s.guestsFactor === s.guestCount
                      ? `+${s.guestCount}`
                      : `+${s.guestsFactor % 1 === 0 ? s.guestsFactor : s.guestsFactor.toFixed(1)}`;
                  return (
                  <tr key={s.memberId}>
                    <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100">{s.name}</td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={s.playedFull ? "tet-pill-full" : "tet-pill-half"}>
                        {s.playedFull ? "Full" : "½"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400">
                      {guestLabel}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">{formatAmount(s.owedShare)}</td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-amber-200/60 dark:border-gray-700 bg-amber-50/80 dark:bg-gray-800 font-semibold">
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300" colSpan={3}>Total</td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                    {typeof totalCost === "number" ? formatAmount(totalCost) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rounded-xl border border-amber-200/50 dark:border-gray-800 p-4 space-y-3">
            <h3 className="tet-section-title text-sm">Sync to Splitwise</h3>

            {synced || syncStatus === "success" ? (
              <div className="tet-alert-success">
                <CheckCircle size={16} />
                Synced to Splitwise successfully.
              </div>
            ) : (
              <>
                {!splitwiseConfigured && (
                  <div className="tet-alert-info">
                    <Info size={15} className="mt-0.5 shrink-0" />
                    Splitwise sync is disabled. Add SPLITWISE_API_KEY and SPLITWISE_GROUP_ID to your environment.
                  </div>
                )}
                {splitwiseConfigured && missingSplitwiseIds.length > 0 && (
                  <div className="tet-alert-info">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>
                      Missing Splitwise ID for: <strong>{missingSplitwiseIds.join(", ")}</strong>. Update in Management.
                    </span>
                  </div>
                )}
                {splitwiseConfigured && !savedOk && (
                  <div className="tet-alert-info bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700">
                    <Info size={15} className="mt-0.5 shrink-0" />
                    Save settlement data first before syncing.
                  </div>
                )}
                {syncStatus === "error" && syncError && (
                  <p className="tet-alert-error">
                    {syncError}
                  </p>
                )}
                <button
                  onClick={handleSync} disabled={!canSync}
                  className="tet-btn-primary-lg disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600"
                >
                  {syncStatus === "syncing" && <Loader2 size={15} className="animate-spin" />}
                  {syncStatus === "syncing" ? "Syncing…" : "Sync to Splitwise"}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
