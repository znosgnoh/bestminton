"use client";

import { useCallback, useMemo, useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import SettleAmountModal from "@/components/cam/SettleAmountModal";
import AdminPinModal from "@/components/ui/AdminPinModal";
import ErrorBanner from "@/components/ui/ErrorBanner";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { useAdminPin } from "@/hooks/useAdminPin";
import { DRINK_LABEL, formatDrinkAmount } from "@/lib/constants";
import { simplifyDebts, splitDebtsForMember } from "@/lib/drinkDebtUtils";
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

const FULL_VIEW_THRESHOLD = 5;

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

function formatCompactAmount(amount: number): string {
  return `${amount} ly`;
}

function MemberSummaryCards({
  memberName,
  totalOwes,
  totalOwed,
}: {
  memberName: string;
  totalOwes: number;
  totalOwed: number;
}) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="tet-card px-3 py-2.5 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          {memberName} owes
        </p>
        <p className="mt-0.5 text-base font-semibold text-orange-600 dark:text-orange-400">
          {formatCompactAmount(totalOwes)}
        </p>
      </div>
      <div className="tet-card px-3 py-2.5 text-center">
        <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
          Owed to {memberName}
        </p>
        <p className="mt-0.5 text-base font-semibold text-emerald-600 dark:text-emerald-400">
          {formatCompactAmount(totalOwed)}
        </p>
      </div>
    </div>
  );
}

function CompactDebtRow({
  debt,
  isHighlighted,
  isSettling,
  settlingDisabled,
  onSettleClick,
}: {
  debt: DrinkDebtDTO;
  isHighlighted: boolean;
  isSettling: boolean;
  settlingDisabled: boolean;
  onSettleClick: () => void;
}) {
  return (
    <li
      className={`tet-card flex items-center gap-2 px-3 py-2.5 ${
        isHighlighted
          ? "ring-2 ring-orange-300/80 dark:ring-orange-700/60 bg-orange-50/50 dark:bg-orange-950/20"
          : ""
      }`}
    >
      <p className="min-w-0 flex-1 text-sm leading-snug">
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
          {formatCompactAmount(debt.amount)}
        </span>
      </p>
      <button
        type="button"
        onClick={onSettleClick}
        disabled={isSettling || settlingDisabled}
        className="tet-btn-primary shrink-0 min-h-9 px-2.5 py-1.5 text-xs inline-flex items-center justify-center gap-1"
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
}: {
  title: string;
  debts: DrinkDebtDTO[];
  highlightMemberId?: number;
  settlingKey: string | null;
  onPaid: (debt: DrinkDebtDTO) => void;
}) {
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

          return (
            <CompactDebtRow
              key={key}
              debt={debt}
              isHighlighted={isHighlighted}
              isSettling={settlingKey === key}
              settlingDisabled={settlingKey !== null && settlingKey !== key}
              onSettleClick={() => onPaid(debt)}
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
  const { unlocked, pinRequired, unlock, getStoredPin } = useAdminPin();
  const [pending, setPending] = useState<PendingSettle | null>(null);
  const [amountPrompt, setAmountPrompt] = useState<AmountPrompt | null>(null);
  const [showPinModal, setShowPinModal] = useState(false);
  const [settlingKey, setSettlingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showFullPairwise, setShowFullPairwise] = useState(false);

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

  const highlightedMember = useMemo(() => {
    if (highlightMemberId === undefined) return null;
    const name = nameById.get(highlightMemberId);
    if (!name) return null;
    const { owes, owedBy } = splitDebtsForMember(simplifiedDebts, highlightMemberId);
    return {
      name,
      owes,
      owedBy,
      totalOwes: owes.reduce((sum, d) => sum + d.amount, 0),
      totalOwed: owedBy.reduce((sum, d) => sum + d.amount, 0),
    };
  }, [highlightMemberId, nameById, simplifiedDebts]);

  const showPairwiseToggle = debts.length > FULL_VIEW_THRESHOLD;

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
      setShowPinModal(true);
    } else {
      void runSettle(item, pinRequired ? getStoredPin() : undefined);
    }
  }

  function handlePaid(debt: DrinkDebtDTO) {
    if (debt.amount > 1) {
      setAmountPrompt({
        debtorId: debt.debtorId,
        creditorId: debt.creditorId,
        maxAmount: debt.amount,
        debtorName: debt.debtorName,
        creditorName: debt.creditorName,
      });
      return;
    }

    proceedToSettle({
      debtorId: debt.debtorId,
      creditorId: debt.creditorId,
      amount: debt.amount,
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
    if (pending) await runSettle(pending, pin);
    return null;
  }

  if (simplifiedDebts.length === 0) {
    return (
      <div className="tet-empty">
        <OrangeJuiceIcon size={32} className="mx-auto mb-2 text-orange-400" />
        <p className="font-medium">All settled!</p>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          No outstanding {DRINK_LABEL.toLowerCase()} debts.
        </p>
      </div>
    );
  }

  const mainList =
    highlightedMember !== null ? (
      <div className="space-y-4">
        <DebtSection
          title={`${highlightedMember.name} owes`}
          debts={highlightedMember.owes}
          highlightMemberId={highlightMemberId}
          settlingKey={settlingKey}
          onPaid={handlePaid}
        />
        <DebtSection
          title={`Owed to ${highlightedMember.name}`}
          debts={highlightedMember.owedBy}
          highlightMemberId={highlightMemberId}
          settlingKey={settlingKey}
          onPaid={handlePaid}
        />
      </div>
    ) : (
      <ul className="space-y-2" aria-label={`Outstanding ${DRINK_LABEL} debts`}>
        {simplifiedDebts.map((debt) => {
          const key = `${debt.debtorId}:${debt.creditorId}`;
          return (
            <CompactDebtRow
              key={key}
              debt={debt}
              isHighlighted={false}
              isSettling={settlingKey === key}
              settlingDisabled={settlingKey !== null && settlingKey !== key}
              onSettleClick={() => handlePaid(debt)}
            />
          );
        })}
      </ul>
    );

  return (
    <div className="space-y-3">
      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
      {success && <div className="tet-alert-success text-sm">{success}</div>}

      {highlightedMember !== null && (
        <MemberSummaryCards
          memberName={highlightedMember.name}
          totalOwes={highlightedMember.totalOwes}
          totalOwed={highlightedMember.totalOwed}
        />
      )}

      {showFullPairwise ? (
        <ul className="space-y-2" aria-label={`All pairwise ${DRINK_LABEL} debts`}>
          {debts.map((debt) => {
            const key = `${debt.debtorId}:${debt.creditorId}`;
            const isHighlighted =
              highlightMemberId !== undefined &&
              (debt.debtorId === highlightMemberId || debt.creditorId === highlightMemberId);

            return (
              <CompactDebtRow
                key={key}
                debt={debt}
                isHighlighted={isHighlighted}
                isSettling={settlingKey === key}
                settlingDisabled={settlingKey !== null && settlingKey !== key}
                onSettleClick={() => handlePaid(debt)}
              />
            );
          })}
        </ul>
      ) : (
        mainList
      )}

      {showPairwiseToggle && (
        <div className="pt-1">
          <button
            type="button"
            onClick={() => setShowFullPairwise((open) => !open)}
            className="w-full min-h-10 rounded-xl border border-amber-200/80 dark:border-gray-700 px-3 text-sm font-medium text-gray-600 dark:text-gray-400 hover:bg-amber-50/70 dark:hover:bg-gray-800/70 inline-flex items-center justify-center gap-1.5 transition-colors"
            aria-expanded={showFullPairwise}
          >
            {showFullPairwise ? (
              <>
                <ChevronUp size={16} />
                Hide all pairwise debts
              </>
            ) : (
              <>
                <ChevronDown size={16} />
                Show all pairwise debts ({debts.length})
              </>
            )}
          </button>
        </div>
      )}

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
        title="PIN to Settle"
        onSubmit={handlePinSubmit}
        onCancel={() => {
          setShowPinModal(false);
          setPending(null);
        }}
      />
    </div>
  );
}
