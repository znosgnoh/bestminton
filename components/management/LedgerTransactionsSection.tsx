"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronDown, Loader2, RotateCcw, ScrollText, Undo2 } from "lucide-react";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import ErrorBanner from "@/components/ui/ErrorBanner";
import { useI18n } from "@/contexts/LocaleContext";
import { formatCurrency } from "@/lib/currency";
import { toCents } from "@/lib/ledgerMath";
import * as dataService from "@/lib/dataService";
import type { LedgerExpenseDTO, LedgerExpenseKind, LedgerSnapshotDTO } from "@/lib/types";
import type { Locale } from "@/lib/i18n";

interface LedgerTransactionsSectionProps {
  dbAvailable: boolean;
}

function intlLocale(locale: Locale): string {
  if (locale === "zh") return "zh-CN";
  if (locale === "vi") return "vi-VN";
  return "en-US";
}

function formatWhen(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function kindLabel(
  kind: LedgerExpenseKind,
  t: (key: "balances.opening" | "balances.match" | "balances.shuttlecock") => string
): string {
  if (kind === "OPENING") return t("balances.opening");
  if (kind === "SHUTTLECOCK") return t("balances.shuttlecock");
  return t("balances.match");
}

function hasPaidShares(expense: LedgerExpenseDTO): boolean {
  return expense.shares.some((s) => toCents(s.paid) > 0);
}

function paidShareCount(expense: LedgerExpenseDTO): number {
  return expense.shares.filter((s) => toCents(s.paid) >= toCents(s.owed)).length;
}

export default function LedgerTransactionsSection({ dbAvailable }: LedgerTransactionsSectionProps) {
  const { t, locale } = useI18n();
  const [snapshot, setSnapshot] = useState<LedgerSnapshotDTO | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [pending, setPending] = useState<{ type: "rollback" | "reset"; expense: LedgerExpenseDTO } | null>(
    null
  );
  const [listExpanded, setListExpanded] = useState(true);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const next = await dataService.getLedger();
      setSnapshot(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("management.transactionsLoadError"));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!dbAvailable) {
      setLoading(false);
      return;
    }
    void load();
  }, [dbAvailable]);

  const expenses = snapshot
    ? [...snapshot.expenses].sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.id - a.id)
    : [];

  async function runPending() {
    if (!pending) return;
    const { type, expense } = pending;
    setBusyId(expense.id);
    setError(null);
    setSuccess(null);
    setPending(null);
    try {
      const next =
        type === "rollback"
          ? await dataService.rollbackLedgerExpense(expense.id)
          : await dataService.resetLedgerExpensePaid(expense.id);
      setSnapshot(next);
      setSuccess(
        type === "rollback" ? t("management.rollbackOk") : t("management.resetPaidOk")
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("management.transactionsLoadError"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <section>
      <button
        type="button"
        onClick={() => setListExpanded((open) => !open)}
        className="mb-3 flex w-full items-center justify-between text-left"
        aria-expanded={listExpanded}
      >
        <h2 className="tet-section-title inline-flex items-center gap-2">
          <ScrollText size={16} />
          {t("management.transactions")}
          {snapshot ? ` (${expenses.length})` : ""}
        </h2>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${listExpanded ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
          listExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
        aria-hidden={!listExpanded}
      >
        <div className="overflow-hidden space-y-3">
          <p className="tet-muted text-sm">{t("management.transactionsHint")}</p>
          {loading && (
            <p className="inline-flex items-center gap-2 text-sm text-gray-500">
              <Loader2 size={14} className="animate-spin" />
              {t("common.loading")}
            </p>
          )}
          {error && <ErrorBanner message={error} onRetry={() => void load()} />}
          {!dbAvailable && <ErrorBanner message={t("balances.dbRequired")} />}
          {success && <div className="tet-alert-success text-sm">{success}</div>}

          {!loading && expenses.length === 0 && !error && (
            <div className="tet-empty">
              <p className="font-medium">{t("management.transactionsEmpty")}</p>
            </div>
          )}

          <ul className="space-y-2">
            {expenses.map((expense) => {
              const paidCount = paidShareCount(expense);
              const canReset = hasPaidShares(expense);
              const busy = busyId === expense.id;
              return (
                <li key={expense.id} className="tet-card p-3 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {expense.matchId != null ? (
                        <Link
                          href={`/matches/${expense.matchId}?manage=1`}
                          className="block truncate font-medium text-gray-900 dark:text-gray-100 hover:underline underline-offset-2"
                        >
                          {expense.title}
                        </Link>
                      ) : (
                        <p className="truncate font-medium text-gray-900 dark:text-gray-100">
                          {expense.title}
                        </p>
                      )}
                      <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                        {kindLabel(expense.kind, t)} · {formatWhen(expense.createdAt, locale)} ·{" "}
                        {expense.paidByName}
                      </p>
                    </div>
                    <p className="shrink-0 text-sm font-semibold tabular-nums text-gray-900 dark:text-gray-100">
                      {formatCurrency(expense.amount, expense.currency)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-[11px]">
                    <span
                      className={
                        expense.status === "SETTLED"
                          ? "tet-pill-full"
                          : "tet-pill-half"
                      }
                    >
                      {expense.status === "SETTLED"
                        ? t("management.statusSettled")
                        : t("management.statusOpen")}
                    </span>
                    {expense.shares.length > 0 && (
                      <span className="text-gray-500 dark:text-gray-400">
                        {t("management.paidProgress", {
                          paid: paidCount,
                          total: expense.shares.length,
                        })}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canReset && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setPending({ type: "reset", expense })}
                        className="tet-btn-ghost border border-gray-200 dark:border-gray-700 px-2.5 py-1.5 text-xs inline-flex items-center gap-1 disabled:opacity-50"
                      >
                        {busy ? <Loader2 size={13} className="animate-spin" /> : <Undo2 size={13} />}
                        {t("management.resetPaid")}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => setPending({ type: "rollback", expense })}
                      className="tet-btn-ghost border border-red-200 dark:border-red-900/50 px-2.5 py-1.5 text-xs text-red-600 dark:text-red-400 inline-flex items-center gap-1 disabled:opacity-50"
                    >
                      {busy ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      {t("management.rollback")}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      <ConfirmDialog
        open={pending !== null}
        title={
          pending?.type === "reset"
            ? t("management.resetPaidConfirmTitle")
            : t("management.rollbackConfirmTitle")
        }
        message={
          pending?.type === "reset"
            ? t("management.resetPaidConfirm")
            : t("management.rollbackConfirm")
        }
        confirmLabel={
          pending?.type === "reset" ? t("management.resetPaid") : t("management.rollback")
        }
        danger={pending?.type === "rollback"}
        onCancel={() => setPending(null)}
        onConfirm={() => void runPending()}
      />
    </section>
  );
}
