"use client";

import { useCallback, useMemo, useState, type ReactNode } from "react";
import { Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import SettleAmountModal from "@/components/cam/SettleAmountModal";
import AdminPinModal from "@/components/ui/AdminPinModal";
import ErrorBanner from "@/components/ui/ErrorBanner";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { useAdminPin } from "@/hooks/useAdminPin";
import { useI18n } from "@/contexts/LocaleContext";
import { DRINK_LABEL, formatDrinkAmount } from "@/lib/constants";
import {
  isDirectPairwiseDebt,
  isSettleableSuggestedEdge,
  netBalancesByMember,
  simplifyDebts,
  splitDebtsForMember,
} from "@/lib/drinkDebtUtils";
import * as dataService from "@/lib/dataService";
import type { DrinkDebtDTO } from "@/lib/types";

interface DebtsTableProps {
  debts: DrinkDebtDTO[];
  highlightMemberId?: number;
  onSettled: () => void;
}

type PendingSettle = { debtorId: number; creditorId: number; amount: number };

type AmountPrompt = {
  debtorId: number;
  creditorId: number;
  maxAmount: number;
  debtorName: string;
  creditorName: string;
};

type PinPurpose = "settle" | "expand";

function attachNames(
  rows: Array<{ debtorId: number; creditorId: number; amount: number }>,
  nameById: Map<number, string>
): DrinkDebtDTO[] {
  return rows.map((r) => ({
    ...r,
    debtorName: nameById.get(r.debtorId) ?? `Member ${r.debtorId}`,
    creditorName: nameById.get(r.creditorId) ?? `Member ${r.creditorId}`,
    updatedAt: "",
  }));
}

function MemberSummaryCards({
  memberName,
  totalOwes,
  totalOwed,
  ly,
}: {
  memberName: string;
  totalOwes: number;
  totalOwed: number;
  ly: (amount: number) => string;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="tet-card px-3 py-2.5 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {memberName} owes
        </p>
        <p className="mt-0.5 text-base font-semibold text-orange-600 dark:text-orange-400">
          {ly(totalOwes)}
        </p>
      </div>
      <div className="tet-card px-3 py-2.5 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Owed to {memberName}
        </p>
        <p className="mt-0.5 text-base font-semibold text-emerald-600 dark:text-emerald-400">
          {ly(totalOwed)}
        </p>
      </div>
    </div>
  );
}

function DebtKindBadge({
  direct,
  directLabel,
  netLabel,
  directTitle,
  netTitle,
}: {
  direct: boolean;
  directLabel: string;
  netLabel: string;
  directTitle: string;
  netTitle: string;
}) {
  return (
    <span
      className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
        direct
          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          : "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200"
      }`}
      title={direct ? directTitle : netTitle}
    >
      {direct ? directLabel : netLabel}
    </span>
  );
}

function CompactDebtRow({
  debt,
  isHighlighted,
  isSettling,
  settlingDisabled,
  settleBlocked,
  settleBlockedReason,
  onSettleClick,
  badge,
}: {
  debt: DrinkDebtDTO;
  isHighlighted: boolean;
  isSettling: boolean;
  settlingDisabled: boolean;
  settleBlocked?: boolean;
  settleBlockedReason?: string;
  onSettleClick: () => void;
  badge?: ReactNode;
}) {
  const blocked = Boolean(settleBlocked);
  return (
    <li
      className={`tet-card flex items-center gap-2 px-3 py-2.5 ${
        isHighlighted
          ? "ring-2 ring-orange-300/80 dark:ring-orange-700/60 bg-orange-50/50 dark:bg-orange-950/20"
          : ""
      }`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm leading-snug">
          <span className="font-medium text-gray-900 dark:text-gray-100">{debt.debtorName}</span>
          <span className="mx-1 text-gray-400" aria-hidden>
            →
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{debt.creditorName}</span>
          <span className="mx-1 text-gray-400" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-0.5 font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">
            <OrangeJuiceIcon size={12} className="shrink-0" />
            {debt.amount} ly
          </span>
        </p>
        {badge && <div className="mt-1">{badge}</div>}
        {blocked && settleBlockedReason && (
          <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400 leading-snug">
            {settleBlockedReason}
          </p>
        )}
      </div>
      <button
        type="button"
        onClick={onSettleClick}
        disabled={isSettling || settlingDisabled || blocked}
        title={blocked ? settleBlockedReason : undefined}
        className="tet-btn-primary shrink-0 min-h-9 px-2.5 py-1.5 text-xs inline-flex items-center justify-center gap-1 disabled:opacity-50"
        aria-label={`Mark ${formatDrinkAmount(debt.amount)} from ${debt.debtorName} to ${debt.creditorName} as paid`}
      >
        {isSettling ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <>
            <Check size={14} />
            Paid
          </>
        )}
      </button>
    </li>
  );
}

function DebtSection({
  title,
  debts,
  highlightMemberId,
  settlingKey,
  onPaid,
  showKindBadge,
  ledger,
  requireSettleable,
  blockedReason,
}: {
  title: string;
  debts: DrinkDebtDTO[];
  highlightMemberId?: number;
  settlingKey: string | null;
  onPaid: (debt: DrinkDebtDTO) => void;
  showKindBadge?: boolean;
  ledger?: DrinkDebtDTO[];
  /** When true, disable Paid if the suggested edge has no pairwise cover and no path. */
  requireSettleable?: boolean;
  blockedReason?: string;
}) {
  const { t } = useI18n();
  if (debts.length === 0) return null;

  return (
    <section>
      <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {title}
      </h3>
      <ul className="space-y-2" aria-label={title}>
        {debts.map((debt) => {
          const key = `${debt.debtorId}:${debt.creditorId}`;
          const isHighlighted =
            highlightMemberId !== undefined &&
            (debt.debtorId === highlightMemberId || debt.creditorId === highlightMemberId);
          const direct = ledger ? isDirectPairwiseDebt(ledger, debt) : true;
          const settleable =
            !requireSettleable || !ledger || isSettleableSuggestedEdge(ledger, debt);

          return (
            <CompactDebtRow
              key={key}
              debt={debt}
              isHighlighted={isHighlighted}
              isSettling={settlingKey === key}
              settlingDisabled={settlingKey !== null && settlingKey !== key}
              settleBlocked={!settleable}
              settleBlockedReason={!settleable ? blockedReason : undefined}
              onSettleClick={() => onPaid(debt)}
              badge={
                showKindBadge ? (
                  <DebtKindBadge
                    direct={direct}
                    directLabel={t("cam.badgeDirect")}
                    netLabel={t("cam.badgeNet")}
                    directTitle={t("cam.badgeDirectTitle")}
                    netTitle={t("cam.badgeNetTitle")}
                  />
                ) : undefined
              }
            />
          );
        })}
      </ul>
    </section>
  );
}

export default function DebtsTable({
  debts,
  highlightMemberId,
  onSettled,
}: DebtsTableProps) {
  const { t } = useI18n();
  const { unlocked, pinRequired, unlock, getStoredPin } = useAdminPin();
  const [pending, setPending] = useState<PendingSettle | null>(null);
  const [amountPrompt, setAmountPrompt] = useState<AmountPrompt | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pinPurpose, setPinPurpose] = useState<PinPurpose>("settle");
  const [showFullPairwise, setShowFullPairwise] = useState(false);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const canViewFullLedger = !pinRequired || unlocked;
  const ly = (amount: number) => t("cam.ly", { amount });

  const nameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const d of debts) {
      map.set(d.debtorId, d.debtorName);
      map.set(d.creditorId, d.creditorName);
    }
    return map;
  }, [debts]);

  const simplifiedDebts = useMemo(
    () => attachNames(simplifyDebts(debts), nameById),
    [debts, nameById]
  );

  const netPositions = useMemo(() => {
    return netBalancesByMember(debts).map((row) => ({
      ...row,
      name: nameById.get(row.memberId) ?? `Member ${row.memberId}`,
    }));
  }, [debts, nameById]);

  /** Collapsed = auto-balance within connected groups only (not every raw pairwise row). */
  const settleableSuggested = useMemo(
    () => simplifiedDebts.filter((d) => isSettleableSuggestedEdge(debts, d)),
    [simplifiedDebts, debts]
  );
  const collapsedDebts = settleableSuggested;
  const blockedSuggestedCount = simplifiedDebts.length - settleableSuggested.length;

  const highlightedMember = useMemo(() => {
    if (highlightMemberId === undefined) return null;
    const name = nameById.get(highlightMemberId);
    if (!name) return null;
    const { owes, owedBy } = splitDebtsForMember(collapsedDebts, highlightMemberId);
    return {
      name,
      owes,
      owedBy,
      totalOwes: owes.reduce((sum, d) => sum + d.amount, 0),
      totalOwed: owedBy.reduce((sum, d) => sum + d.amount, 0),
    };
  }, [highlightMemberId, nameById, collapsedDebts]);

  const ledgerGroups = useMemo(() => {
    if (highlightMemberId === undefined) {
      return { involving: [] as DrinkDebtDTO[], other: debts };
    }
    const involving: DrinkDebtDTO[] = [];
    const other: DrinkDebtDTO[] = [];
    for (const d of debts) {
      if (d.debtorId === highlightMemberId || d.creditorId === highlightMemberId) {
        involving.push(d);
      } else {
        other.push(d);
      }
    }
    return { involving, other };
  }, [debts, highlightMemberId]);

  const runSettle = useCallback(
    async (item: PendingSettle, pin?: string) => {
      const key = `${item.debtorId}:${item.creditorId}`;
      setSettlingKey(key);
      setError(null);
      setSuccess(null);

      try {
        const result = await dataService.settleDebt({
          debtorId: item.debtorId,
          creditorId: item.creditorId,
          amount: item.amount,
          pin,
        });
        setSuccess(
          result.remaining > 0
            ? `Settled ${formatDrinkAmount(result.settled)} — ${formatDrinkAmount(result.remaining)} remaining.`
            : `Settled ${formatDrinkAmount(result.settled)} — debt cleared.`
        );
        onSettled();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Settlement failed.");
      } finally {
        setSettlingKey(null);
        setPending(null);
      }
    },
    [onSettled]
  );

  function proceedToSettle(item: PendingSettle) {
    setPending(item);
    if (pinRequired && !unlocked) {
      setPinPurpose("settle");
      setShowPinModal(true);
    } else {
      void runSettle(item, pinRequired ? getStoredPin() : undefined);
    }
  }

  function handleToggleFullLedger() {
    if (showFullPairwise) {
      setShowFullPairwise(false);
      return;
    }
    if (!canViewFullLedger) {
      setPending(null);
      setPinPurpose("expand");
      setShowPinModal(true);
      return;
    }
    setShowFullPairwise(true);
  }

  function handlePaid(debt: DrinkDebtDTO, opts?: { fromLedger?: boolean }) {
    const fromLedger = opts?.fromLedger === true;
    if (!fromLedger && !isSettleableSuggestedEdge(debts, debt)) {
      setError(t("cam.settleNoPath"));
      return;
    }

    // Cap to the row amount: pairwise for ledger, displayed amount for suggested.
    const maxAmount = debt.amount;

    if (maxAmount > 1) {
      setAmountPrompt({
        debtorId: debt.debtorId,
        creditorId: debt.creditorId,
        maxAmount,
        debtorName: debt.debtorName,
        creditorName: debt.creditorName,
      });
      return;
    }

    proceedToSettle({
      debtorId: debt.debtorId,
      creditorId: debt.creditorId,
      amount: maxAmount,
    });
  }

  function handleAmountConfirm(amount: number) {
    if (!amountPrompt) return;
    const item: PendingSettle = {
      debtorId: amountPrompt.debtorId,
      creditorId: amountPrompt.creditorId,
      amount,
    };
    setAmountPrompt(null);
    proceedToSettle(item);
  }

  async function handlePinSubmit(pin: string): Promise<string | null> {
    const pinError = await unlock(pin);
    if (pinError) return pinError;
    setShowPinModal(false);
    if (pinPurpose === "expand") {
      setShowFullPairwise(true);
      return null;
    }
    if (pending) await runSettle(pending, pin);
    return null;
  }

  if (debts.length === 0) {
    return (
      <div className="tet-empty">
        <OrangeJuiceIcon size={32} className="mx-auto mb-2 text-orange-400" />
        <p className="font-medium">{t("cam.allSettled")}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          No outstanding {DRINK_LABEL.toLowerCase()} debts.
        </p>
      </div>
    );
  }

  const showingLedger = showFullPairwise && canViewFullLedger;

  const modeBanner = (
    <div className="rounded-xl border border-amber-200/70 dark:border-gray-700 bg-amber-50/40 dark:bg-gray-900/40 px-3 py-2.5">
      <p className="text-xs font-semibold text-gray-800 dark:text-gray-100">
        {showingLedger ? t("cam.modeLedger") : t("cam.modeSuggested")}
      </p>
      <p className="mt-0.5 text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
        {showingLedger ? t("cam.modeLedgerHint") : t("cam.modeSuggestedHint")}
      </p>
    </div>
  );

  const netPositionsPanel =
    !showingLedger && netPositions.length > 0 ? (
      <div className="space-y-1.5">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {t("cam.netPositions")}
        </p>
        <ul className="flex flex-wrap gap-1.5">
          {netPositions.map((p) => (
            <li
              key={p.memberId}
              className={`rounded-lg px-2 py-1 text-xs font-medium ${
                p.net < 0
                  ? "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-300"
                  : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
              }`}
            >
              <span className="font-semibold">{p.name}</span>{" "}
              {p.net < 0
                ? t("cam.netOwes", { amount: ly(-p.net) })
                : t("cam.netOwed", { amount: ly(p.net) })}
            </li>
          ))}
        </ul>
      </div>
    ) : null;

  const ledgerHintBanner =
    !showingLedger && blockedSuggestedCount > 0 ? (
      <div className="rounded-xl border border-amber-200/80 dark:border-gray-700 bg-white/70 dark:bg-gray-950/40 px-3 py-2.5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-gray-600 dark:text-gray-400 leading-relaxed">
          {t("cam.blockedSuggestedHint", { count: blockedSuggestedCount })}
        </p>
        <button
          type="button"
          onClick={handleToggleFullLedger}
          className="shrink-0 min-h-9 rounded-lg border border-amber-200 dark:border-gray-600 px-3 text-xs font-semibold text-gray-700 dark:text-gray-200 hover:bg-amber-50 dark:hover:bg-gray-800"
        >
          {canViewFullLedger
            ? t("cam.openLedgerToSettle")
            : t("cam.pinForLedger", { count: debts.length })}
        </button>
      </div>
    ) : null;

  const mainList =
    collapsedDebts.length === 0 && simplifiedDebts.length === 0 ? (
      <div className="tet-empty py-6">
        <p className="font-medium">{t("cam.netBalancesClear")}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("cam.netBalancesClearHint")}
        </p>
      </div>
    ) : collapsedDebts.length === 0 ? (
      <div className="tet-empty py-6">
        <p className="font-medium">{t("cam.noSettleableSuggested")}</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {t("cam.noSettleableSuggestedHint")}
        </p>
      </div>
    ) : highlightedMember !== null ? (
      <div className="space-y-4">
        <DebtSection
          title={`${highlightedMember.name} owes`}
          debts={highlightedMember.owes}
          highlightMemberId={highlightMemberId}
          settlingKey={settlingKey}
          onPaid={(d) => handlePaid(d)}
          showKindBadge
          ledger={debts}
        />
        <DebtSection
          title={`Owed to ${highlightedMember.name}`}
          debts={highlightedMember.owedBy}
          highlightMemberId={highlightMemberId}
          settlingKey={settlingKey}
          onPaid={(d) => handlePaid(d)}
          showKindBadge
          ledger={debts}
        />
      </div>
    ) : (
      <ul className="space-y-2" aria-label={t("cam.modeSuggested")}>
        {collapsedDebts.map((debt) => {
          const key = `${debt.debtorId}:${debt.creditorId}`;
          const direct = isDirectPairwiseDebt(debts, debt);
          return (
            <CompactDebtRow
              key={key}
              debt={debt}
              isHighlighted={false}
              isSettling={settlingKey === key}
              settlingDisabled={settlingKey !== null && settlingKey !== key}
              onSettleClick={() => handlePaid(debt)}
              badge={
                <DebtKindBadge
                  direct={direct}
                  directLabel={t("cam.badgeDirect")}
                  netLabel={t("cam.badgeNet")}
                  directTitle={t("cam.badgeDirectTitle")}
                  netTitle={t("cam.badgeNetTitle")}
                />
              }
            />
          );
        })}
      </ul>
    );

  const fullPairwiseList = (
    <div className="space-y-4">
      {highlightMemberId !== undefined && ledgerGroups.involving.length > 0 && (
        <DebtSection
          title={t("cam.involving", {
            name: nameById.get(highlightMemberId) ?? "member",
          })}
          debts={ledgerGroups.involving}
          highlightMemberId={highlightMemberId}
          settlingKey={settlingKey}
          onPaid={(d) => handlePaid(d, { fromLedger: true })}
        />
      )}
      <DebtSection
        title={
          highlightMemberId !== undefined && ledgerGroups.involving.length > 0
            ? t("cam.otherPairs")
            : t("cam.modeLedger")
        }
        debts={
          highlightMemberId !== undefined && ledgerGroups.involving.length > 0
            ? ledgerGroups.other
            : debts
        }
        highlightMemberId={highlightMemberId}
        settlingKey={settlingKey}
        onPaid={(d) => handlePaid(d, { fromLedger: true })}
      />
    </div>
  );

  return (
    <div className="space-y-3">
      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
      {success && <div className="tet-alert-success text-sm">{success}</div>}

      {modeBanner}
      {netPositionsPanel}
      {ledgerHintBanner}

      {highlightedMember !== null && !showingLedger && (
        <MemberSummaryCards
          memberName={highlightedMember.name}
          totalOwes={highlightedMember.totalOwes}
          totalOwed={highlightedMember.totalOwed}
          ly={ly}
        />
      )}

      {showingLedger ? fullPairwiseList : mainList}

      <div className="pt-1">
        <button
          type="button"
          onClick={handleToggleFullLedger}
          className="w-full min-h-10 rounded-xl border border-amber-200/80 dark:border-gray-700 px-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-amber-50/70 dark:hover:bg-gray-800/70 inline-flex items-center justify-center gap-1.5 transition-colors"
          aria-expanded={showingLedger}
        >
          {showingLedger ? (
            <>
              <ChevronUp size={16} />
              {t("cam.hideLedger")}
            </>
          ) : canViewFullLedger ? (
            <>
              <ChevronDown size={16} />
              {t("cam.showLedger", { count: debts.length })}
            </>
          ) : (
            <>
              <ChevronDown size={16} />
              {t("cam.pinForLedger", { count: debts.length })}
            </>
          )}
        </button>
      </div>

      <SettleAmountModal
        open={amountPrompt !== null}
        maxAmount={amountPrompt?.maxAmount ?? 1}
        debtorName={amountPrompt?.debtorName ?? ""}
        creditorName={amountPrompt?.creditorName ?? ""}
        onSubmit={handleAmountConfirm}
        onCancel={() => setAmountPrompt(null)}
      />

      <AdminPinModal
        open={showPinModal}
        title={pinPurpose === "expand" ? t("cam.pinLedgerTitle") : t("cam.pinSettleTitle")}
        onSubmit={handlePinSubmit}
        onCancel={() => {
          setShowPinModal(false);
          setPending(null);
        }}
      />
    </div>
  );
}
