"use client";

import { useI18n } from "@/contexts/LocaleContext";
import { formatCurrency } from "@/lib/currency";
import { fromCents, toCents } from "@/lib/ledgerMath";
import type { Locale } from "@/lib/i18n";
import type { LedgerExpenseDTO, LedgerExpenseKind } from "@/lib/types";

export interface PairBreakdownItem {
  expenseId: number;
  kind: LedgerExpenseKind;
  title: string;
  createdAt: string;
  remainder: number;
}

function intlLocale(locale: Locale): string {
  if (locale === "zh") return "zh-CN";
  if (locale === "vi") return "vi-VN";
  return "en-US";
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(iso));
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
              <p className="font-medium text-gray-800 dark:text-gray-200 truncate">{item.title}</p>
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
