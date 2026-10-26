"use client";

import Link from "next/link";
import { useI18n } from "@/contexts/LocaleContext";
import { formatCurrency } from "@/lib/currency";
import { formatLocal } from "@/lib/datetime";
import type { Locale } from "@/lib/i18n";
import type { LedgerExpenseKind } from "@/lib/types";
import type { PairBreakdownItem } from "@/lib/balanceBreakdown";

export type { PairBreakdownItem } from "@/lib/balanceBreakdown";
export {
  shareRemainder,
  pairBreakdownItems,
  pairGrossBreakdownItems,
  pairDirectRemainder,
  openRemittancesToMember,
} from "@/lib/balanceBreakdown";

function formatDate(iso: string, locale: Locale): string {
  return formatLocal(iso, locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
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
    if (kind === "COURT") return t("balances.court");
    return t("balances.match");
  }

  return (
    <div className="border-t border-amber-200/70 dark:border-gray-700 px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
        {t("balances.breakdown")}
      </p>
      <ul className="mt-1.5 space-y-1.5">
        {items.map((item) => {
          const credit = item.remainder < 0;
          const money = formatCurrency(Math.abs(item.remainder), currency);
          return (
            <li
              key={`${item.expenseId}:${item.remainder}`}
              className="flex items-start justify-between gap-2 text-xs"
            >
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
                  {kindLabel(item.kind)}
                  {credit ? ` · ${t("balances.remittanceCredit")}` : ""} ·{" "}
                  {formatDate(item.createdAt, locale)}
                </p>
              </div>
              <span
                className={`shrink-0 font-semibold tabular-nums ${
                  credit
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-orange-600 dark:text-orange-400"
                }`}
              >
                {credit ? `−${money}` : money}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
