"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import BalanceBreakdown, { pairBreakdownItems } from "@/components/balances/BalanceBreakdown";
import { useI18n } from "@/contexts/LocaleContext";
import { formatCurrency } from "@/lib/currency";
import type { LedgerEdgeDTO, LedgerExpenseDTO } from "@/lib/types";

interface BalanceEdgeRowProps {
  edge: LedgerEdgeDTO;
  expenses: LedgerExpenseDTO[];
  currency: string;
  isPaying: boolean;
  payingDisabled: boolean;
  onPaid: (edge: LedgerEdgeDTO) => void;
}

export default function BalanceEdgeRow({
  edge,
  expenses,
  currency,
  isPaying,
  payingDisabled,
  onPaid,
}: BalanceEdgeRowProps) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const items = pairBreakdownItems(expenses, edge.debtorId, edge.creditorId);
  const canPay = items.length > 0;
  const money = formatCurrency(edge.amount, currency);

  return (
    <li className="tet-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          type="button"
          onClick={() => {
            if (canPay) setExpanded((open) => !open);
          }}
          disabled={!canPay}
          className={`min-w-0 flex-1 text-left ${canPay ? "cursor-pointer" : "cursor-default"}`}
          aria-expanded={canPay ? expanded : undefined}
        >
          <p className="text-sm leading-snug">
            <span className="font-medium text-gray-900 dark:text-gray-100">{edge.debtorName}</span>
            <span className="mx-1 text-gray-400" aria-hidden>
              →
            </span>
            <span className="font-medium text-gray-900 dark:text-gray-100">{edge.creditorName}</span>
            <span className="mx-1 text-gray-400" aria-hidden>
              ·
            </span>
            <span className="font-semibold text-orange-600 dark:text-orange-400 whitespace-nowrap">
              {money}
            </span>
          </p>
          {canPay && (
            <span className="mt-1 inline-flex items-center gap-0.5 text-[11px] font-medium text-gray-500 dark:text-gray-400">
              {t("balances.breakdown")}
              {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            </span>
          )}
        </button>
        {canPay && (
          <button
            type="button"
            onClick={() => onPaid(edge)}
            disabled={isPaying || payingDisabled}
            className="tet-btn-primary shrink-0 min-h-9 px-2.5 py-1.5 text-xs inline-flex items-center justify-center gap-1 disabled:opacity-50"
            aria-label={`${t("balances.markPaid")} ${edge.debtorName} → ${edge.creditorName} ${money}`}
          >
            {isPaying ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              <>
                <Check size={14} />
                {t("balances.markPaid")}
              </>
            )}
          </button>
        )}
      </div>
      {expanded && canPay && <BalanceBreakdown items={items} currency={currency} />}
    </li>
  );
}
