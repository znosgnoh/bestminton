"use client";

import Link from "next/link";
import { useI18n } from "@/contexts/LocaleContext";
import { formatCurrency } from "@/lib/currency";
import { formatLocal } from "@/lib/datetime";
import { fromCents, toCents } from "@/lib/ledgerMath";
import type { Locale } from "@/lib/i18n";
import type { LedgerExpenseDTO, LedgerExpenseKind } from "@/lib/types";

export interface PairBreakdownItem {
  expenseId: number;
  kind: LedgerExpenseKind;
  matchId: number | null;
  title: string;
  createdAt: string;
  remainder: number;
}

function formatDate(iso: string, locale: Locale): string {
  return formatLocal(iso, locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function shareRemainder(owed: number, paid: number): number {
  return fromCents(toCents(owed) - toCents(paid));
}

export function pairBreakdownItems(
  expenses: LedgerExpenseDTO[],
  debtorId: number,
  creditorId: number
): PairBreakdownItem[] {
  const items: PairBreakdownItem[] = [];
  for (const expense of expenses) {
    if (expense.paidByMemberId !== creditorId) continue;
    for (const share of expense.shares) {
      if (share.memberId !== debtorId) continue;
      const remainder = shareRemainder(share.owed, share.paid);
      if (remainder <= 0) continue;
      items.push({
        expenseId: expense.id,
        kind: expense.kind,
        matchId: expense.matchId,
        title: expense.title,
        createdAt: expense.createdAt,
        remainder,
      });
    }
  }
  return items;
}

export function pairDirectRemainder(
  expenses: LedgerExpenseDTO[],
  debtorId: number,
  creditorId: number
): number {
  return fromCents(
    pairBreakdownItems(expenses, debtorId, creditorId).reduce(
      (sum, item) => sum + toCents(item.remainder),
      0
    )
  );
}

interface BalanceBreakdownProps {
  items: PairBreakdownItem[];
  currency: string;
}

export default function BalanceBreakdown({ items, currency }: BalanceBreakdownProps) {
  const { locale, t } = useI18n();

  if (items.length === 0) return null;

  function kindLabel(kind: LedgerExpenseKind): string {
    if (kind === "OPENING") return t("balances.opening");
    if (kind === "SHUTTLECOCK") return t("balances.shuttlecock");
    return t("balances.match");
  }

  return (
    <div className="border-t border-amber-200/70 dark:border-gray-700 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t("balances.breakdown")}
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item) => (
          <li key={item.expenseId} className="flex items-start justify-between gap-2 text-xs">
            <div className="min-w-0">
              {item.matchId != null ? (
                <Link
                  href={`/matches/${item.matchId}`}
                  className="block truncate font-medium text-gray-800 dark:text-gray-200 hover:underline underline-offset-2"
                  aria-label={`${t("balances.openMatch")}: ${item.title}`}
                >
                  {item.title}
                </Link>
              ) : (
                <p className="truncate font-medium text-gray-800 dark:text-gray-200">{item.title}</p>
              )}
              <p className="text-gray-500 dark:text-gray-400">
                {kindLabel(item.kind)} · {formatDate(item.createdAt, locale)}
              </p>
            </div>
            <span className="shrink-0 font-semibold text-orange-600 dark:text-orange-400">
              {formatCurrency(item.remainder, currency)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
