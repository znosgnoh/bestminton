"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle, Info, Loader2, Plus, Trash2 } from "lucide-react";
import { calculateShares } from "@/lib/calculations";
import { currencyLabel, formatAmount, getCurrencySymbol } from "@/lib/currency";
import { useI18n } from "@/contexts/LocaleContext";
import {
  findDefaultShuttlecockRecipientId,
  findMemberIdByShuttlecockDefaultName,
  shouldCreateShuttlecockRemittance,
} from "@/lib/shuttlecock";
import {
  DEFAULT_COURT_BOOKING_HOURS,
  DEFAULT_COURT_FEE_PER_HOUR,
  DEFAULT_SHUTTLECOCK_UNIT_PRICE,
  bookingRemittances,
  computeSettlement,
  parseSettlementDetails,
  type CourtBookingInput,
} from "@/lib/settlement";
import * as dataService from "@/lib/dataService";
import type { MatchDTO, MemberDTO, RegistrationDTO, CalculatedShare } from "@/lib/types";

interface SettleFormProps {
  match: MatchDTO;
  registrations: RegistrationDTO[];
  members: MemberDTO[];
  currencyCode: string;
  shuttlecockFeePerHour: number;
}

type BookingRow = { key: string; memberId: number | null; hours: number | "" };

function rowKey(): string {
  return Math.random().toString(36).slice(2);
}

function emptyBooking(hours: number = DEFAULT_COURT_BOOKING_HOURS): BookingRow {
  return { key: rowKey(), memberId: null, hours };
}

function initialBookings(match: MatchDTO): BookingRow[] {
  const details = parseSettlementDetails(match.settlementDetails);
  if (details && details.bookings.length > 0) {
    return details.bookings.map((b) => ({
      key: rowKey(),
      memberId: b.memberId,
      hours: b.hours,
    }));
  }
  if (match.hours != null && match.hours > 0) {
    return [{ key: rowKey(), memberId: match.paidByMemberId, hours: match.hours }];
  }
  return [emptyBooking()];
}

function completeBookings(rows: BookingRow[]): CourtBookingInput[] {
  return rows.flatMap((row) =>
    row.memberId != null && typeof row.hours === "number" && row.hours > 0
      ? [{ memberId: row.memberId, hours: row.hours }]
      : []
  );
}

export default function SettleForm({
  match,
  registrations,
  members,
  currencyCode,
}: SettleFormProps) {
  const { t } = useI18n();
  const savedDetails = parseSettlementDetails(match.settlementDetails);
  const defaultShuttleRecipient =
    match.shuttlecockRecipientMemberId ??
    findMemberIdByShuttlecockDefaultName(members) ??
    findDefaultShuttlecockRecipientId(registrations);

  const [shuttleCount, setShuttleCount] = useState<number | "">(
    savedDetails?.shuttlecockCount ?? ""
  );
  const [shuttlePrice, setShuttlePrice] = useState<number | "">(
    savedDetails?.shuttlecockUnitPrice ?? DEFAULT_SHUTTLECOCK_UNIT_PRICE
  );
  const [courtFeePerHour, setCourtFeePerHour] = useState<number | "">(
    savedDetails?.courtFeePerHour ?? DEFAULT_COURT_FEE_PER_HOUR
  );
  const [bookings, setBookings] = useState<BookingRow[]>(() => initialBookings(match));
  const [paidByMemberId, setPaidByMemberId] = useState<number | null>(match.paidByMemberId);
  const [shuttlecockRecipientMemberId, setShuttlecockRecipientMemberId] = useState<number | null>(
    defaultShuttleRecipient
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedOk, setSavedOk] = useState(match.totalCost !== null);
  const [synced, setSynced] = useState(match.synced);
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setSavedOk(false);
  }, [registrations]);
  const [recordStatus, setRecordStatus] = useState<"idle" | "recording" | "success" | "error">(
    "idle"
  );
  const [recordError, setRecordError] = useState<string | null>(null);
  const [recordedOnBalances, setRecordedOnBalances] = useState(false);

  const settlement = useMemo(() => {
    const count = typeof shuttleCount === "number" ? shuttleCount : 0;
    const price = typeof shuttlePrice === "number" ? shuttlePrice : DEFAULT_SHUTTLECOCK_UNIT_PRICE;
    const rate =
      typeof courtFeePerHour === "number" ? courtFeePerHour : DEFAULT_COURT_FEE_PER_HOUR;
    return computeSettlement({
      shuttlecockCount: count,
      shuttlecockUnitPrice: price,
      courtFeePerHour: rate,
      bookings: completeBookings(bookings),
    });
  }, [shuttleCount, shuttlePrice, courtFeePerHour, bookings]);

  const shares: CalculatedShare[] = useMemo(() => {
    if (!(settlement.totalCost > 0) || !registrations.length) return [];
    return calculateShares(registrations, settlement.totalCost, settlement.courtHours);
  }, [settlement, registrations]);

  const paidByName =
    registrations.find((r) => r.memberId === paidByMemberId)?.member.name ??
    members.find((m) => m.id === paidByMemberId)?.name ??
    null;
  const shuttlecockRecipientName =
    members.find((m) => m.id === shuttlecockRecipientMemberId)?.name ??
    registrations.find((r) => r.memberId === shuttlecockRecipientMemberId)?.member.name ??
    null;

  const alreadyComplete = synced || recordedOnBalances;
  const canRecord =
    shares.length > 0 &&
    paidByMemberId !== null &&
    savedOk &&
    !alreadyComplete &&
    recordStatus !== "recording";

  function markDirty() {
    setSavedOk(false);
  }

  async function handleSave() {
    if (!(settlement.totalCost > 0)) {
      setSaveError(t("matches.needCostItems"));
      return;
    }
    if (!paidByMemberId) {
      setSaveError(t("matches.selectWhoPaid"));
      return;
    }
    if (!shuttlecockRecipientMemberId) {
      setSaveError(t("matches.selectShuttleRecipient"));
      return;
    }
    const incomplete = bookings.some(
      (row) =>
        (row.memberId != null && !(typeof row.hours === "number" && row.hours > 0)) ||
        (typeof row.hours === "number" && row.hours > 0 && row.memberId == null)
    );
    if (incomplete) {
      setSaveError(t("matches.needCostItems"));
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const details = {
        shuttlecockCount: typeof shuttleCount === "number" ? shuttleCount : 0,
        shuttlecockUnitPrice:
          typeof shuttlePrice === "number" ? shuttlePrice : DEFAULT_SHUTTLECOCK_UNIT_PRICE,
        courtFeePerHour:
          typeof courtFeePerHour === "number" ? courtFeePerHour : DEFAULT_COURT_FEE_PER_HOUR,
        bookings: completeBookings(bookings),
      };
      await dataService.saveMatchSettlement(match.id, {
        totalCost: settlement.totalCost,
        hours: settlement.courtHours,
        paidByMemberId,
        shuttlecockRecipientMemberId,
        settlementDetails: details,
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

    setRecordStatus("recording");
    setRecordError(null);
    try {
      await dataService.recordMatchLedger(match.id);
      setRecordStatus("success");
      setSynced(true);
      setRecordedOnBalances(true);
    } catch (err) {
      setRecordStatus("error");
      setRecordError(err instanceof Error ? err.message : t("matches.somethingWrong"));
    }
  }

  const inputCls = "tet-input-lg";
  const cur = currencyLabel(currencyCode);
  const curSym = getCurrencySymbol(currencyCode);
  const priceNum = typeof shuttlePrice === "number" ? shuttlePrice : DEFAULT_SHUTTLECOCK_UNIT_PRICE;
  const rateNum =
    typeof courtFeePerHour === "number" ? courtFeePerHour : DEFAULT_COURT_FEE_PER_HOUR;
  const countNum = typeof shuttleCount === "number" ? shuttleCount : 0;

  return (
    <div className="tet-card p-5 space-y-5">
      <h2 className="tet-section-title">{t("matches.settleTitle")}</h2>

      <div className="space-y-3">
        <div>
          <label className="tet-label text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("matches.shuttleRecipient")}
          </label>
          <select
            value={shuttlecockRecipientMemberId ?? ""}
            onChange={(e) => {
              setShuttlecockRecipientMemberId(e.target.value ? Number(e.target.value) : null);
              markDirty();
            }}
            className={inputCls}
          >
            <option value="">{t("matches.selectPayer")}</option>
            {members.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Who receives the shuttlecock fee (default Tiến Hoàng).
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="tet-label text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("matches.shuttleCount")}
            </label>
            <input
              type="number"
              min="0"
              step="1"
              value={shuttleCount}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setShuttleCount(isNaN(v) ? "" : v);
                markDirty();
              }}
              className={inputCls}
              placeholder="e.g. 12"
            />
          </div>
          <div>
            <label className="tet-label text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              {t("matches.shuttlePrice", { currency: cur })}
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={shuttlePrice}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                setShuttlePrice(isNaN(v) ? "" : v);
                markDirty();
              }}
              className={inputCls}
            />
          </div>
        </div>

        <div>
          <label className="tet-label text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("matches.courtFeePerHour", { currency: cur })}
          </label>
          <input
            type="number"
            min="0"
            step="0.001"
            value={courtFeePerHour}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              setCourtFeePerHour(isNaN(v) ? "" : v);
              markDirty();
            }}
            className={inputCls}
          />
        </div>

        <div>
          <label className="tet-label text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("matches.courtBookings")}
          </label>
          <div className="space-y-2">
            {bookings.map((row) => (
              <div key={row.key} className="flex items-center gap-2">
                <select
                  value={row.memberId ?? ""}
                  onChange={(e) => {
                    const memberId = e.target.value ? Number(e.target.value) : null;
                    setBookings((prev) =>
                      prev.map((b) => (b.key === row.key ? { ...b, memberId } : b))
                    );
                    markDirty();
                  }}
                  className={`${inputCls} flex-1`}
                >
                  <option value="">{t("matches.selectBooker")}</option>
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="0"
                  step="0.5"
                  aria-label={t("matches.bookingHours")}
                  value={row.hours}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    setBookings((prev) =>
                      prev.map((b) =>
                        b.key === row.key ? { ...b, hours: isNaN(v) ? "" : v } : b
                      )
                    );
                    markDirty();
                  }}
                  className={`${inputCls} w-24`}
                />
                <button
                  type="button"
                  onClick={() => {
                    setBookings((prev) =>
                      prev.length > 1 ? prev.filter((b) => b.key !== row.key) : [emptyBooking()]
                    );
                    markDirty();
                  }}
                  className="tet-btn-icon-danger shrink-0"
                  aria-label={t("matches.removeBooking")}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => {
                setBookings((prev) => [...prev, emptyBooking()]);
                markDirty();
              }}
              className="tet-btn-ghost inline-flex items-center gap-1.5 px-3 py-2 text-sm cursor-pointer"
            >
              <Plus size={15} />
              {t("matches.addBooking")}
            </button>
          </div>
        </div>

        <div>
          <label className="tet-label text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {t("matches.paidBy")}
          </label>
          <select
            value={paidByMemberId ?? ""}
            onChange={(e) => {
              setPaidByMemberId(e.target.value ? Number(e.target.value) : null);
              markDirty();
            }}
            className={inputCls}
          >
            <option value="">{t("matches.selectPayer")}</option>
            {registrations.map((r) => (
              <option key={r.memberId} value={r.memberId}>
                {r.member.name}
              </option>
            ))}
          </select>
        </div>

        {settlement.totalCost > 0 && (
          <div className="rounded-xl border border-amber-200/50 dark:border-gray-800 bg-amber-50/40 dark:bg-gray-900/40 p-3 space-y-1.5 text-sm">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              {t("matches.feeBreakdown")}
            </p>
            <div className="flex justify-between text-gray-700 dark:text-gray-300">
              <span>
                {t("matches.courtFeeLine", {
                  rate: formatAmount(rateNum),
                  hours: formatAmount(settlement.courtHours),
                })}
              </span>
              <span className="font-semibold tabular-nums">
                {curSym}
                {formatAmount(settlement.courtFee)}
              </span>
            </div>
            <div className="flex justify-between text-gray-700 dark:text-gray-300">
              <span>
                {t("matches.shuttleFeeLine", {
                  count: countNum,
                  price: formatAmount(priceNum),
                })}
              </span>
              <span className="font-semibold tabular-nums">
                {curSym}
                {formatAmount(settlement.shuttlecockFee)}
              </span>
            </div>
            <div className="flex justify-between border-t border-amber-200/60 dark:border-gray-700 pt-1.5 font-semibold text-gray-900 dark:text-gray-100">
              <span>{t("matches.total")}</span>
              <span className="tabular-nums">
                {curSym}
                {formatAmount(settlement.totalCost)}
              </span>
            </div>
            {paidByName && (
              <div className="pt-1 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                <p>{t("matches.remitEveryonePays", { payer: paidByName })}</p>
                {shuttlecockRecipientName &&
                  shouldCreateShuttlecockRemittance({
                    title: match.title,
                    shuttlecockFee: settlement.shuttlecockFee,
                    paidByMemberId,
                    shuttlecockRecipientMemberId,
                  }) && (
                    <p>
                      {t("matches.remitShuttle", {
                        payer: paidByName,
                        amount: `${curSym}${formatAmount(settlement.shuttlecockFee)}`,
                        recipient: shuttlecockRecipientName,
                      })}
                    </p>
                  )}
                {bookingRemittances(
                  // bookers other than Paid By get a court remittance
                  {
                    shuttlecockCount: countNum,
                    shuttlecockUnitPrice: priceNum,
                    courtFeePerHour: rateNum,
                    bookings: completeBookings(bookings),
                  },
                  paidByMemberId
                ).map((row) => {
                  const bookerName =
                    members.find((m) => m.id === row.memberId)?.name ??
                    registrations.find((r) => r.memberId === row.memberId)?.member.name ??
                    String(row.memberId);
                  return (
                    <p key={row.memberId}>
                      {t("matches.remitCourt", {
                        payer: paidByName,
                        amount: `${curSym}${formatAmount(row.amount)}`,
                        booker: bookerName,
                      })}
                    </p>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {saveError && <p className="tet-alert-error">{saveError}</p>}

        <button onClick={handleSave} disabled={saving} className="tet-btn-primary-lg">
          {saving && <Loader2 size={15} className="animate-spin" />}
          {saving ? "Saving…" : t("matches.saveSettlement")}
        </button>
      </div>

      {shares.length > 0 && (
        <div className="space-y-3">
          <h3 className="tet-section-title text-sm">{t("matches.costSplitPreview")}</h3>
          <div className="overflow-x-auto rounded-xl border border-amber-200/50 dark:border-gray-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-amber-50/80 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400">
                  <th className="px-3 py-2 text-left">{t("matches.name")}</th>
                  <th className="px-3 py-2 text-center">{t("matches.time")}</th>
                  <th className="px-3 py-2 text-center">{t("matches.guestsCol")}</th>
                  <th className="px-3 py-2 text-right">{t("matches.owes", { symbol: curSym })}</th>
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
                    {t("matches.total")}
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900 dark:text-gray-100">
                    {formatAmount(settlement.totalCost)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="rounded-xl border border-amber-200/50 dark:border-gray-800 p-4 space-y-3">
            <h3 className="tet-section-title text-sm">{t("matches.recordExpense")}</h3>

            {alreadyComplete ? (
              <div className="tet-alert-success">
                <CheckCircle size={16} />
                <span>{t("matches.recordedOnBalances")}</span>
              </div>
            ) : (
              <>
                {!savedOk && (
                  <div className="tet-alert-info bg-gray-50 dark:bg-gray-800 text-gray-600 dark:text-gray-400 ring-gray-200 dark:ring-gray-700">
                    <Info size={15} className="mt-0.5 shrink-0" />
                    {t("matches.saveBeforeSync")}
                  </div>
                )}
                {recordStatus === "error" && recordError && (
                  <p className="tet-alert-error">
                    <AlertTriangle size={15} className="shrink-0" />
                    {recordError}
                  </p>
                )}
                <button
                  onClick={handleRecord}
                  disabled={!canRecord}
                  className="tet-btn-primary-lg disabled:cursor-not-allowed disabled:bg-gray-200 dark:disabled:bg-gray-800 disabled:text-gray-400 dark:disabled:text-gray-600"
                >
                  {recordStatus === "recording" && <Loader2 size={15} className="animate-spin" />}
                  {recordStatus === "recording" ? t("matches.recording") : t("matches.recordExpense")}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
