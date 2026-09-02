"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, RotateCcw } from "lucide-react";
import SettleAmountModal from "@/components/cam/SettleAmountModal";
import AdminPinModal from "@/components/ui/AdminPinModal";
import Avatar from "@/components/ui/Avatar";
import ErrorBanner from "@/components/ui/ErrorBanner";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { useI18n } from "@/contexts/LocaleContext";
import { useAdminPin } from "@/hooks/useAdminPin";
import { useMemberPin } from "@/hooks/useMemberPin";
import * as dataService from "@/lib/dataService";
import type {
  DrinkSettleTransactionDTO,
  OjBalanceDTO,
  OjPoolSnapshotDTO,
} from "@/lib/types";

interface DebtsTableProps {
  snapshot: OjPoolSnapshotDTO;
  highlightMemberId?: number;
  onChanged: () => Promise<void>;
}

type PendingSettle = {
  from: OjBalanceDTO;
  to: OjBalanceDTO;
  amount: number;
};

function PoolMemberRow({
  balance,
  selected,
  highlighted,
  onSelect,
}: {
  balance: OjBalanceDTO;
  selected: boolean;
  highlighted: boolean;
  onSelect: () => void;
}) {
  return (
    <li id={`cam-member-${balance.memberId}`}>
      <button
        type="button"
        onClick={onSelect}
        className={`tet-card flex w-full items-center gap-3 px-3 py-2.5 text-left transition ${
          selected
            ? "ring-2 ring-orange-400 bg-orange-50/70 dark:bg-orange-950/30"
            : highlighted
              ? "ring-2 ring-orange-300/80 bg-orange-50/50 dark:ring-orange-700/60 dark:bg-orange-950/20"
              : "hover:bg-orange-50/50 dark:hover:bg-orange-950/20"
        }`}
        aria-pressed={selected}
      >
        <Avatar name={balance.name} avatarUrl={balance.avatarUrl} size="sm" />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900 dark:text-gray-100">
          {balance.name}
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 font-semibold text-orange-600 dark:text-orange-400">
          <OrangeJuiceIcon size={14} />
          {Math.abs(balance.ojBalance)} ly
        </span>
      </button>
    </li>
  );
}

export default function DebtsTable({
  snapshot,
  highlightMemberId,
  onChanged,
}: DebtsTableProps) {
  const { locale, t } = useI18n();
  const memberPin = useMemberPin();
  const adminPin = useAdminPin();
  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [amountPrompt, setAmountPrompt] = useState(false);
  const [pendingSettle, setPendingSettle] = useState<PendingSettle | null>(null);
  const [showMemberPin, setShowMemberPin] = useState(false);
  const [pendingRollback, setPendingRollback] =
    useState<DrinkSettleTransactionDTO | null>(null);
  const [showAdminPin, setShowAdminPin] = useState(false);
  const [settling, setSettling] = useState(false);
  const [rollingBackId, setRollingBackId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const owners = useMemo(
    () => snapshot.balances.filter((balance) => balance.ojBalance > 0),
    [snapshot.balances]
  );
  const owers = useMemo(
    () => snapshot.balances.filter((balance) => balance.ojBalance < 0),
    [snapshot.balances]
  );
  const selectedFrom = owners.find((balance) => balance.memberId === fromId) ?? null;
  const selectedTo = owers.find((balance) => balance.memberId === toId) ?? null;
  const maxAmount =
    selectedFrom && selectedTo
      ? Math.min(selectedFrom.ojBalance, -selectedTo.ojBalance)
      : 0;

  useEffect(() => {
    if (highlightMemberId === undefined) return;
    document
      .getElementById(`cam-member-${highlightMemberId}`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [highlightMemberId]);

  const runSettle = useCallback(
    async (item: PendingSettle, pin?: string) => {
      setSettling(true);
      setError(null);
      setSuccess(null);
      try {
        await dataService.settleDebt({
          fromMemberId: item.from.memberId,
          toMemberId: item.to.memberId,
          amount: item.amount,
          pin,
        });
        setSuccess(t("cam.settleSuccess", { amount: item.amount }));
        setFromId(null);
        setToId(null);
        await onChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("cam.settleFailed"));
      } finally {
        setSettling(false);
        setPendingSettle(null);
      }
    },
    [onChanged, t]
  );

  function beginSettle(item: PendingSettle) {
    setPendingSettle(item);
    if (memberPin.pinRequired && !memberPin.unlocked) {
      setShowMemberPin(true);
      return;
    }
    void runSettle(item, memberPin.pinRequired ? memberPin.getStoredPin() : undefined);
  }

  async function handleMemberPinSubmit(pin: string): Promise<string | null> {
    const pinError = await memberPin.unlock(pin);
    if (pinError) return pinError;
    setShowMemberPin(false);
    if (pendingSettle) await runSettle(pendingSettle, pin);
    return null;
  }

  const runRollback = useCallback(
    async (transaction: DrinkSettleTransactionDTO, pin?: string) => {
      setRollingBackId(transaction.id);
      setError(null);
      setSuccess(null);
      try {
        await dataService.rollbackDrinkSettle(transaction.id, pin);
        setSuccess(t("cam.rollbackSuccess"));
        await onChanged();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("cam.rollbackFailed"));
      } finally {
        setRollingBackId(null);
        setPendingRollback(null);
      }
    },
    [onChanged, t]
  );

  function requestRollback(transaction: DrinkSettleTransactionDTO) {
    if (
      !window.confirm(
        t("cam.rollbackConfirm", { amount: transaction.amount })
      )
    ) {
      return;
    }
    setPendingRollback(transaction);
    if (adminPin.pinRequired && !adminPin.unlocked) {
      setShowAdminPin(true);
      return;
    }
    void runRollback(
      transaction,
      adminPin.pinRequired ? adminPin.getStoredPin() : undefined
    );
  }

  async function handleAdminPinSubmit(pin: string): Promise<string | null> {
    const pinError = await adminPin.unlock(pin);
    if (pinError) return pinError;
    setShowAdminPin(false);
    if (pendingRollback) await runRollback(pendingRollback, pin);
    return null;
  }

  const canSettle =
    selectedFrom !== null &&
    selectedTo !== null &&
    maxAmount > 0 &&
    !settling &&
    !memberPin.checking;

  return (
    <div className="space-y-4">
      {error && <ErrorBanner message={error} onRetry={() => setError(null)} />}
      {success && <div className="tet-alert-success text-sm">{success}</div>}

      {owners.length === 0 && owers.length === 0 ? (
        <div className="tet-empty">
          <OrangeJuiceIcon size={32} className="mx-auto mb-2 text-orange-400" />
          <p className="font-medium">{t("cam.allSettled")}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              {t("cam.ownsHeading")}
            </h2>
            <ul className="space-y-2">
              {owners.map((balance) => (
                <PoolMemberRow
                  key={balance.memberId}
                  balance={balance}
                  selected={fromId === balance.memberId}
                  highlighted={highlightMemberId === balance.memberId}
                  onSelect={() => setFromId(balance.memberId)}
                />
              ))}
            </ul>
          </section>

          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-orange-700 dark:text-orange-400">
              {t("cam.owesHeading")}
            </h2>
            <ul className="space-y-2">
              {owers.map((balance) => (
                <PoolMemberRow
                  key={balance.memberId}
                  balance={balance}
                  selected={toId === balance.memberId}
                  highlighted={highlightMemberId === balance.memberId}
                  onSelect={() => setToId(balance.memberId)}
                />
              ))}
            </ul>
          </section>
        </div>
      )}

      {owners.length > 0 && owers.length > 0 && (
        <div className="tet-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <label className="tet-label">
              {t("cam.settlePickFrom")}
              <select
                value={fromId ?? ""}
                onChange={(event) => setFromId(Number(event.target.value) || null)}
                className="tet-input mt-1 w-full"
              >
                <option value="">—</option>
                {owners.map((balance) => (
                  <option key={balance.memberId} value={balance.memberId}>
                    {balance.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="tet-label">
              {t("cam.settlePickTo")}
              <select
                value={toId ?? ""}
                onChange={(event) => setToId(Number(event.target.value) || null)}
                className="tet-input mt-1 w-full"
              >
                <option value="">—</option>
                {owers.map((balance) => (
                  <option key={balance.memberId} value={balance.memberId}>
                    {balance.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            type="button"
            disabled={!canSettle}
            onClick={() => setAmountPrompt(true)}
            className="tet-btn-primary mt-3 min-h-11 w-full inline-flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {settling ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
            {t("cam.settleTitle")}
            {maxAmount > 0 && (
              <span className="font-normal opacity-80">
                · {t("cam.settleMax", { amount: maxAmount })}
              </span>
            )}
          </button>
        </div>
      )}

      <section className="space-y-2">
        <h2 className="tet-section-title">{t("cam.historyHeading")}</h2>
        {snapshot.transactions.length === 0 ? (
          <div className="tet-empty py-5 text-sm">{t("cam.historyEmpty")}</div>
        ) : (
          <ul className="space-y-2">
            {snapshot.transactions.map((transaction) => {
              const rolledBack = transaction.rolledBackAt !== null;
              return (
                <li
                  key={transaction.id}
                  className={`tet-card flex items-center gap-3 px-3 py-2.5 ${
                    rolledBack ? "opacity-60" : ""
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-900 dark:text-gray-100">
                      <span className="font-medium">{transaction.fromName}</span>
                      <span className="mx-1.5 text-gray-400">→</span>
                      <span className="font-medium">{transaction.toName}</span>
                      <span className="ml-2 font-semibold text-orange-600 dark:text-orange-400">
                        {t("cam.ly", { amount: transaction.amount })}
                      </span>
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      {new Intl.DateTimeFormat(locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      }).format(new Date(transaction.createdAt))}
                      {rolledBack && (
                        <span className="ml-2 rounded-full bg-gray-200 px-2 py-0.5 font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
                          {t("cam.rolledBack")}
                        </span>
                      )}
                    </p>
                  </div>
                  {!rolledBack && (
                    <button
                      type="button"
                      disabled={
                        rollingBackId !== null ||
                        adminPin.checking
                      }
                      onClick={() => requestRollback(transaction)}
                      className="tet-btn-ghost min-h-9 shrink-0 px-2.5 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      {rollingBackId === transaction.id ? (
                        <Loader2 size={14} className="animate-spin" />
                      ) : (
                        <RotateCcw size={14} />
                      )}
                      {t("cam.rollback")}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <SettleAmountModal
        open={amountPrompt && selectedFrom !== null && selectedTo !== null}
        maxAmount={maxAmount}
        fromName={selectedFrom?.name ?? ""}
        toName={selectedTo?.name ?? ""}
        onSubmit={(amount) => {
          setAmountPrompt(false);
          if (selectedFrom && selectedTo) {
            beginSettle({ from: selectedFrom, to: selectedTo, amount });
          }
        }}
        onCancel={() => setAmountPrompt(false)}
      />

      <AdminPinModal
        open={showMemberPin}
        title={t("common.enterMemberPin")}
        onSubmit={handleMemberPinSubmit}
        onCancel={() => {
          setShowMemberPin(false);
          setPendingSettle(null);
        }}
      />
      <AdminPinModal
        open={showAdminPin}
        title={t("cam.pinRollbackTitle")}
        onSubmit={handleAdminPinSubmit}
        onCancel={() => {
          setShowAdminPin(false);
          setPendingRollback(null);
        }}
      />
    </div>
  );
}
