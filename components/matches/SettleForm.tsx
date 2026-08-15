"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { Loader2, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { calculateShares } from "@/lib/calculations";
import { currencyLabel, formatAmount, getCurrencySymbol } from "@/lib/currency";
import { useI18n } from "@/contexts/LocaleContext";
import {
  findDefaultShuttlecockRecipientId,
  findMemberIdByShuttlecockDefaultName,
  isSingleMatchTitle,
  shouldCreateShuttlecockRemittance,
  splitSettlementFees,
} from "@/lib/shuttlecock";
import * as dataService from "@/lib/dataService";
import type { MatchDTO, MemberDTO, RegistrationDTO, CalculatedShare } from "@/lib/types";

interface SettleFormProps {
  match: MatchDTO;
  registrations: RegistrationDTO[];
  members: MemberDTO[];
  splitwiseConfigured: boolean;
  currencyCode: string;
  shuttlecockFeePerHour: number;
}

export default function SettleForm({
  match,
  registrations,
  members,
  splitwiseConfigured,
  currencyCode,
  shuttlecockFeePerHour,
}: SettleFormProps) {
  const { t } = useI18n();
  const defaultShuttleRecipient =
    match.shuttlecockRecipientMemberId ??
    findMemberIdByShuttlecockDefaultName(members) ??
    findDefaultShuttlecockRecipientId(registrations);

  const [totalCost, setTotalCost] = useState<number | "">(match.totalCost ?? "");
  const [hours, setHours] = useState<number | "">(match.hours ?? "");
  const [paidByMemberId, setPaidByMemberId] = useState<number | null>(match.paidByMemberId);
  const [shuttlecockRecipientMemberId, setShuttlecockRecipientMemberId] = useState<number | null>(
    defaultShuttleRecipient
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(match.totalCost !== null && match.hours !== null);
  const [synced, setSynced] = useState(match.synced);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSavedOk(false);
  }, [registrations]);
  const [recordStatus, setRecordStatus] = useState<
    "idle" | "recording" | "success" | "splitwiseError" | "error"
  >("idle");
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordedOnBalances, setRecordedOnBalances] = useState(false);
  const [shuttlecockSynced, setShuttlecockSynced] = useState(match.shuttlecockRemitted);

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

  const feeSplit = useMemo(() => {
    if (typeof totalCost !== "number" || typeof hours !== "number" || totalCost <= 0 || hours <= 0) {
      return null;
    }
    return splitSettlementFees(totalCost, hours, shuttlecockFeePerHour);
  }, [totalCost, hours, shuttlecockFeePerHour]);

  const paidByName =
    registrations.find((r) => r.memberId === paidByMemberId)?.member.name ??
    members.find((m) => m.id === paidByMemberId)?.name ??
    null;
  const shuttlecockRecipientName =
    members.find((m) => m.id === shuttlecockRecipientMemberId)?.name ??
    registrations.find((r) => r.memberId === shuttlecockRecipientMemberId)?.member.name ??
    null;

  const missingSplitwiseIds = registrations
    .filter((r) => !r.member.splitwiseId)
    .map((r) => r.member.name);

  const missingIdsBlock = splitwiseConfigured && missingSplitwiseIds.length > 0;
  const alreadyComplete = splitwiseConfigured ? synced : recordedOnBalances || synced;
  const canRecord =
    shares.length > 0 &&
    paidByMemberId !== null &&
    savedOk &&
    !missingIdsBlock &&
    !alreadyComplete &&
    recordStatus !== "recording";

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
    if (!shuttlecockRecipientMemberId) {
      setSaveError("Please select who receives the shuttlecock fee.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      await dataService.saveMatchSettlement(match.id, {
        totalCost: totalCost as number,
        hours: hours as number,
        paidByMemberId: paidByMemberId as number,
        shuttlecockRecipientMemberId,
      });
      setSavedOk(true);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRecord() {
    if (!canRecord) return;
    if (splitwiseConfigured && missingSplitwiseIds.length > 0) return;

    setRecordStatus("recording");
    setRecordError(null);
    try {
      const result = await dataService.recordMatchLedger(match.id);
      setShuttlecockSynced(Boolean(result.shuttlecockExpense?.splitwiseExpenseId));
      if (result.splitwiseError) {
        setRecordStatus("splitwiseError");
        setRecordError(result.splitwiseError);
        return;
      }
      setRecordStatus("success");
      if (result.splitwiseSynced) {
        setSynced(true);
      } else {
        setRecordedOnBalances(true);
      }
    } catch (err) {
      setRecordStatus("error");
      setRecordError(err instanceof Error ? err.message : t("matches.somethingWrong"));
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
            type="number"
            min="0"
            step="1"
            value={totalCost}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setTotalCost(isNaN(v) ? "" : v);
              setSavedOk(false);
            }}
            className={inputCls}
            placeholder="e.g. 800"
          />
        </div>

        <div>
          <label className="tet-label text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Hours Played
          </label>
          <input
            type="number"
            min="0"
            step="0.5"
            value={hours}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setHours(isNaN(v) ? "" : v);
              setSavedOk(false);
            }}
            className={inputCls}
            placeholder="e.g. 2"
          />
        </div>

        <div>
          <label className="tet-label text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Paid By
          </label>
          <select
            value={paidByMemberId ?? ""}
            onChange={(e) => {
              setPaidByMemberId(e.target.value ? Number(e.target.value) : null);
              setSavedOk(false);
            }}
            className={inputCls}
          >
            <option value="">— Select —</option>
            {registrations.map((r) => (
              <option key={r.memberId} value={r.memberId}>
                {r.member.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="tet-label text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Shuttlecock
          </label>
          <select
            value={shuttlecockRecipientMemberId ?? ""}
            onChange={(e) => {
              setShuttlecockRecipientMemberId(e.target.value ? Number(e.target.value) : null);
              setSavedOk(false);
            }}
            className={inputCls}
          >
            <option value="">— Select —</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Who receives the shuttlecock fee (default Tiến Hoàng).
            {splitwiseConfigured
              ? " Sync logs Paid By → this person in Splitwise (skipped for Single-title matches)."
              : ""}
          </p>
        </div>

        {feeSplit && (
          <div className="rounded-xl border border-amber-200/50 dark:border-gray-800 bg-amber-50/40 dark:bg-gray-900/40 p-3 space-y-1.5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Fee breakdown
            </p>
            <div className="flex justify-between text-gray-700 dark:text-gray-300">
              <span>
                Court fee
              </span>
              <span className="font-semibold tabular-nums">{curSym}{formatAmount(feeSplit.courtFee)}</span>
            </div>
            <div className="flex justify-between text-gray-700 dark:text-gray-300">
              <span>
                Shuttlecock ({formatAmount(feeSplit.ratePerHour)}/h × {hours}h)
              </span>
              <span className="font-semibold tabular-nums">
                {curSym}{formatAmount(feeSplit.shuttlecockFee)}
              </span>
            </div>
            <div className="flex justify-between border-t border-amber-200/60 dark:border-gray-700 pt-1.5 font-semibold text-gray-900 dark:text-gray-100">
              <span>Total</span>
              <span className="tabular-nums">
                {curSym}{typeof totalCost === "number" ? formatAmount(totalCost) : "—"}
              </span>
            </div>
            {paidByName && shuttlecockRecipientName && (
              <p className="pt-1 text-xs text-gray-600 dark:text-gray-400">
                Everyone pays {paidByName}. {paidByName} remits shuttlecock (
                {curSym}
                {formatAmount(feeSplit.shuttlecockFee)}) to {shuttlecockRecipientName}.
                {shouldCreateShuttlecockRemittance({
                  title: match.title,
                  shuttlecockFee: feeSplit.shuttlecockFee,
                  paidByMemberId,
                  shuttlecockRecipientMemberId,
                }) ? (
                  splitwiseConfigured ? <> Sync also logs this remittance in Splitwise.</> : null
                ) : isSingleMatchTitle(match.title) ? (
                  <> Single sessions skip the shuttlecock remittance.</>
                ) : null}
              </p>
            )}
          </div>
        )}

        {saveError && <p className="tet-alert-error">{saveError}</p>}

        <button onClick={handleSave} disabled={saving} className="tet-btn-primary-lg">
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
                      <td className="px-3 py-2.5 font-medium text-gray-900 dark:text-gray-100">
                        {s.name}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={s.playedFull ? "tet-pill-full" : "tet-pill-half"}>
                          {s.playedFull ? "Full" : "½"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-center text-gray-500 dark:text-gray-400">
                        {guestLabel}
                      </td>
                      <td className="px-3 py-2.5 text-right font-semibold text-gray-900 dark:text-gray-100">
                        {formatAmount(s.owedShare)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-amber-200/60 dark:border-gray-700 bg-amber-50/80 dark:bg-gray-800 font-semibold">
                  <td className="px-3 py-2 text-gray-700 dark:text-gray-300" colSpan={3}>
                    Total
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                    {typeof totalCost === "number" ? formatAmount(totalCost) : "—"}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rounded-xl border border-amber-200/50 dark:border-gray-800 p-4 space-y-3">
            <h3 className="tet-section-title text-sm">
              {splitwiseConfigured ? t("matches.syncSplitwise") : t("matches.recordExpense")}
            </h3>

            {splitwiseConfigured && synced ? (
              <div className="tet-alert-success">
                <CheckCircle size={16} />
                <span>
                  {t("matches.syncedSuccess")}
                  {shuttlecockSynced
                    ? " Shuttlecock remittance (Paid By → Shuttlecock) was logged too."
                    : null}
                </span>
              </div>
            ) : !splitwiseConfigured && (synced || recordedOnBalances) ? (
              <div className="tet-alert-success">
                <CheckCircle size={16} />
                <span>{t("matches.recordedOnBalances")}</span>
              </div>
            ) : (
              <>
                {splitwiseConfigured && missingSplitwiseIds.length > 0 && (
                  <div className="tet-alert-info">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0" />
                    <span>
                      {t("matches.missingSplitwise", { names: missingSplitwiseIds.join(", ") })}
                    </span>
                  </div>
                )}
                {!savedOk && (
                  <div className="tet-alert-info bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700">
                    <Info size={15} className="mt-0.5 shrink-0" />
                    {t("matches.saveBeforeSync")}
                  </div>
                )}
                {recordStatus === "splitwiseError" && (
                  <div className="tet-alert-error">
                    <p>{t("matches.splitwiseFailedRetry")}</p>
                    {recordError && <p className="mt-1">{recordError}</p>}
                  </div>
                )}
                {recordStatus === "error" && recordError && (
                  <p className="tet-alert-error">{recordError}</p>
                )}
                <button
                  onClick={handleRecord}
                  disabled={!canRecord}
                  className="tet-btn-primary-lg disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600"
                >
                  {recordStatus === "recording" && <Loader2 size={15} className="animate-spin" />}
                  {recordStatus === "recording"
                    ? splitwiseConfigured
                      ? t("matches.syncing")
                      : t("matches.recording")
                    : recordStatus === "splitwiseError"
                      ? t("common.retry")
                      : splitwiseConfigured
                        ? t("matches.syncSplitwise")
                        : t("matches.recordExpense")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
