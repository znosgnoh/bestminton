"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Loader2, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { calculateShares } from "@/lib/calculations";
import * as dataService from "@/lib/dataService";
import type { MatchDTO, RegistrationDTO, CalculatedShare } from "@/lib/types";

interface SettleFormProps {
  match: MatchDTO;
  registrations: RegistrationDTO[];
  splitwiseConfigured: boolean;
}

export default function SettleForm({ match, registrations, splitwiseConfigured }: SettleFormProps) {
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

  const inputCls =
    "w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-base text-gray-900 dark:text-gray-100 outline-none focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 dark:focus:ring-emerald-900";

  return (
    <div className="rounded-2xl bg-white dark:bg-gray-900 p-5 shadow-sm ring-1 ring-gray-100 dark:ring-gray-800 space-y-5">
      <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">Settle Match</h2>

      <div className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Total Court Cost (฿)
          </label>
          <input
            type="number" min="0" step="1" value={totalCost}
            onChange={(e) => { const v = parseFloat(e.target.value); setTotalCost(isNaN(v) ? "" : v); setSavedOk(false); }}
            className={inputCls} placeholder="e.g. 800"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Hours Played
          </label>
          <input
            type="number" min="0" step="0.5" value={hours}
            onChange={(e) => { const v = parseFloat(e.target.value); setHours(isNaN(v) ? "" : v); setSavedOk(false); }}
            className={inputCls} placeholder="e.g. 2"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Paid By</label>
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
          <p className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-2 text-sm text-red-700 dark:text-red-300">
            {saveError}
          </p>
        )}

        <button
          onClick={handleSave} disabled={saving}
          className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? "Saving…" : "Save Settlement Data"}
        </button>
      </div>

      {shares.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Cost Split Preview</h3>
          <div className="overflow-x-auto rounded-xl border border-gray-100 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-800 text-xs font-medium text-gray-500 dark:text-gray-400">
                  <th className="px-3 py-2 text-left">Name</th>
                  <th className="px-3 py-2 text-center">Time</th>
                  <th className="px-3 py-2 text-center">+Guests</th>
                  <th className="px-3 py-2 text-right">Owes (฿)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
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
                      <span className={`rounded-full px-1.5 py-0.5 text-xs font-medium ${
                        s.playedFull
                          ? "bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300"
                          : "bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300"
                      }`}>
                        {s.playedFull ? "Full" : "½"}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400">
                      {guestLabel}
                    </td>
                    <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">{s.owedShare.toFixed(2)}</td>
                  </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 font-semibold">
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300" colSpan={3}>Total</td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                    {typeof totalCost === "number" ? totalCost.toFixed(2) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-4 space-y-3">
            <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300">Sync to Splitwise</h3>

            {synced || syncStatus === "success" ? (
              <div className="flex items-center gap-2 rounded-xl bg-emerald-50 dark:bg-emerald-950 px-4 py-3 text-sm font-medium text-emerald-700 dark:text-emerald-300">
                <CheckCircle size={16} />
                Synced to Splitwise successfully.
              </div>
            ) : (
              <>
                {!splitwiseConfigured && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    <Info size={15} className="mt-0.5 shrink-0" />
                    Splitwise sync is disabled. Add SPLITWISE_API_KEY and SPLITWISE_GROUP_ID to your environment.
                  </div>
                )}
                {splitwiseConfigured && missingSplitwiseIds.length > 0 && (
                  <div className="flex items-start gap-2 rounded-xl bg-amber-50 dark:bg-amber-950 px-4 py-3 text-sm text-amber-700 dark:text-amber-300">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>
                      Missing Splitwise ID for: <strong>{missingSplitwiseIds.join(", ")}</strong>. Update in Management.
                    </span>
                  </div>
                )}
                {splitwiseConfigured && !savedOk && (
                  <div className="flex items-start gap-2 rounded-xl bg-gray-50 dark:bg-gray-800 px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                    <Info size={15} className="mt-0.5 shrink-0" />
                    Save settlement data first before syncing.
                  </div>
                )}
                {syncStatus === "error" && syncError && (
                  <p className="rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950 px-4 py-2 text-sm text-red-700 dark:text-red-300">
                    {syncError}
                  </p>
                )}
                <button
                  onClick={handleSync} disabled={!canSync}
                  className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 active:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600 flex items-center justify-center gap-2"
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
