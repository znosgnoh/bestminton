"use client";

import { ExternalLink, X } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";
import { formatCurrency } from "@/lib/currency";
import { formatPaynowMobileDisplay } from "@/lib/paynow";
import { PAYNOW_BANK_APPS, copyAndOpenBankApp } from "@/lib/paynowBanks";

interface PayNowBankSheetProps {
  open: boolean;
  paynowMobile: string;
  amount?: number | null;
  currency?: string;
  onClose: () => void;
}

export default function PayNowBankSheet({
  open,
  paynowMobile,
  amount,
  currency = "SGD",
  onClose,
}: PayNowBankSheetProps) {
  const { t } = useI18n();
  if (!open) return null;

  const money =
    amount != null && amount > 0 ? formatCurrency(amount, currency) : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-black/50 sm:items-center sm:p-4"
      onClick={(e) => {
        e.stopPropagation();
        onClose();
      }}
    >
      <div
        className="tet-card w-full max-w-sm rounded-t-2xl p-5 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paynow-bank-sheet-title"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 id="paynow-bank-sheet-title" className="tet-section-title">
              {t("balances.paynowOpenBank")}
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              {t("balances.paynowOpenBankHint", {
                mobile: formatPaynowMobileDisplay(paynowMobile),
              })}
              {money ? (
                <>
                  {" "}
                  {t("balances.paynowOpenBankAmount", { amount: money })}
                </>
              ) : null}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tet-btn-ghost min-h-9 px-2"
            aria-label={t("common.cancel")}
          >
            <X size={16} />
          </button>
        </div>

        <ul className="mt-4 max-h-72 space-y-1.5 overflow-y-auto">
          {PAYNOW_BANK_APPS.map((bank) => (
            <li key={bank.id}>
              <button
                type="button"
                onClick={() => {
                  void copyAndOpenBankApp(paynowMobile, bank.scheme);
                }}
                className="tet-btn-ghost flex min-h-11 w-full items-center justify-between gap-2 px-3 text-left text-sm"
              >
                <span className="font-medium text-gray-900 dark:text-gray-100">
                  {bank.name}
                </span>
                <ExternalLink size={14} className="shrink-0 text-gray-400" />
              </button>
            </li>
          ))}
        </ul>

        <p className="mt-3 text-[11px] leading-snug text-gray-500 dark:text-gray-400">
          {t("balances.paynowOpenBankFooter")}
        </p>
      </div>
    </div>
  );
}
