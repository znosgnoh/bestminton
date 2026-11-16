"use client";

import { useMemo, useState } from "react";
import { Check, Copy, Link2, QrCode, Smartphone, X } from "lucide-react";
import PayNowBankSheet from "@/components/paynow/PayNowBankSheet";
import PayNowQrImage from "@/components/paynow/PayNowQrImage";
import { useI18n } from "@/contexts/LocaleContext";
import { formatCurrency } from "@/lib/currency";
import {
  buildPayNowPayload,
  formatPaynowMobileDisplay,
  paynowDeeplinkPath,
} from "@/lib/paynow";

interface PayNowQrModalProps {
  open: boolean;
  creditorName: string;
  creditorId: number;
  paynowMobile: string | null;
  amount: number;
  currency: string;
  /** Debtor name for reference / deeplink */
  debtorName?: string;
  onClose: () => void;
  /** Optional — after paying, mark ledger paid */
  onMarkPaid?: () => void;
  markPaidBusy?: boolean;
}

export default function PayNowQrModal({
  open,
  creditorName,
  creditorId,
  paynowMobile,
  amount,
  currency,
  debtorName,
  onClose,
  onMarkPaid,
  markPaidBusy,
}: PayNowQrModalProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState<"mobile" | "link" | null>(null);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);

  const reference = useMemo(() => {
    if (debtorName) return `BM ${debtorName}`.slice(0, 25);
    return "Bestminton".slice(0, 25);
  }, [debtorName]);

  const payload = useMemo(() => {
    if (!paynowMobile) return null;
    return buildPayNowPayload({
      mobile: paynowMobile,
      amount,
      merchantName: creditorName,
      reference,
      amountEditable: false,
    });
  }, [paynowMobile, amount, creditorName, reference]);

  const deeplink = useMemo(
    () =>
      paynowDeeplinkPath(creditorId, {
        amount,
        reference,
        from: debtorName,
      }),
    [creditorId, amount, reference, debtorName]
  );

  if (!open) return null;

  async function copyText(kind: "mobile" | "link", text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1600);
    } catch {
      // clipboard may be blocked
    }
  }

  const money = formatCurrency(amount, currency);
  const absoluteLink =
    typeof window !== "undefined" ? `${window.location.origin}${deeplink}` : deeplink;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="tet-card w-full max-w-sm p-5 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="paynow-modal-title"
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3
              id="paynow-modal-title"
              className="tet-section-title inline-flex items-center gap-1.5"
            >
              <QrCode size={18} className="text-emerald-600 dark:text-amber-400" />
              {t("balances.paynowTitle")}
            </h3>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-gray-100">
                {creditorName}
              </span>
              <span className="mx-1 text-gray-400" aria-hidden>
                ·
              </span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {money}
              </span>
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

        {!paynowMobile || !payload ? (
          <p className="mt-4 text-sm text-gray-600 dark:text-gray-400">
            {t("balances.paynowMissing", { name: creditorName })}
          </p>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-3">
            <PayNowQrImage
              payload={payload}
              size={220}
              alt={t("balances.paynowQrAlt", { name: creditorName, amount: money })}
              onActivate={() => setBankSheetOpen(true)}
              activateLabel={t("balances.paynowTapQr")}
            />
            <p className="text-center text-xs text-gray-500 dark:text-gray-400">
              {t("balances.paynowHint")}
            </p>
            <p className="text-sm font-medium tabular-nums text-gray-800 dark:text-gray-200">
              {formatPaynowMobileDisplay(paynowMobile)}
            </p>
            <button
              type="button"
              onClick={() => setBankSheetOpen(true)}
              className="tet-btn-primary min-h-11 w-full text-sm inline-flex items-center justify-center gap-1.5"
            >
              <Smartphone size={16} />
              {t("balances.paynowOpenBank")}
            </button>
            <div className="flex w-full flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void copyText("mobile", paynowMobile)}
                className="tet-btn-ghost min-h-10 flex-1 text-xs inline-flex items-center justify-center gap-1"
              >
                {copied === "mobile" ? <Check size={14} /> : <Copy size={14} />}
                {copied === "mobile" ? t("balances.paynowCopied") : t("balances.paynowCopyMobile")}
              </button>
              <button
                type="button"
                onClick={() => void copyText("link", absoluteLink)}
                className="tet-btn-ghost min-h-10 flex-1 text-xs inline-flex items-center justify-center gap-1"
              >
                {copied === "link" ? <Check size={14} /> : <Link2 size={14} />}
                {copied === "link" ? t("balances.paynowCopied") : t("balances.paynowCopyLink")}
              </button>
            </div>
          </div>
        )}

        <div className="mt-5 flex gap-2">
          <button type="button" onClick={onClose} className="tet-btn-ghost min-h-11 flex-1">
            {t("common.cancel")}
          </button>
          {onMarkPaid && (
            <button
              type="button"
              onClick={onMarkPaid}
              disabled={markPaidBusy}
              className="tet-btn-primary min-h-11 flex-1 disabled:opacity-50"
            >
              {t("balances.paynowMarkPaid")}
            </button>
          )}
        </div>
      </div>

      {paynowMobile && (
        <PayNowBankSheet
          open={bankSheetOpen}
          paynowMobile={paynowMobile}
          amount={amount}
          currency={currency}
          onClose={() => setBankSheetOpen(false)}
        />
      )}
    </div>
  );
}
