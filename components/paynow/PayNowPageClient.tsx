"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Check, Download, Loader2, QrCode, Smartphone } from "lucide-react";
import PayNowBankSheet from "@/components/paynow/PayNowBankSheet";
import PayNowQrImage from "@/components/paynow/PayNowQrImage";
import { useI18n } from "@/contexts/LocaleContext";
import { formatCurrency } from "@/lib/currency";
import {
  buildPayNowPayload,
  formatPaynowMobileDisplay,
} from "@/lib/paynow";
import { paynowQrFilename, savePayNowQr } from "@/lib/paynowSaveQr";

interface PayNowPageClientProps {
  memberName: string;
  paynowMobile: string | null;
  amount: number | null;
  reference: string | null;
  fromName: string | null;
}

export default function PayNowPageClient({
  memberName,
  paynowMobile,
  amount,
  reference,
  fromName,
}: PayNowPageClientProps) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const [bankSheetOpen, setBankSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const billRef = (reference?.trim() || (fromName ? `BM ${fromName}` : "Bestminton")).slice(
    0,
    25
  );

  const payload = useMemo(() => {
    if (!paynowMobile) return null;
    return buildPayNowPayload({
      mobile: paynowMobile,
      ...(amount != null && amount > 0 ? { amount } : {}),
      merchantName: memberName,
      reference: billRef,
      amountEditable: amount == null || !(amount > 0),
    });
  }, [paynowMobile, amount, memberName, billRef]);

  async function copyMobile() {
    if (!paynowMobile) return;
    try {
      await navigator.clipboard.writeText(paynowMobile);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // ignore
    }
  }

  async function handleSaveQr() {
    if (!payload) return;
    setSaving(true);
    setSaveError(null);
    try {
      await savePayNowQr(
        payload,
        paynowQrFilename({ name: memberName, amount })
      );
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setSaveError(t("balances.paynowSaveFailed"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-4 space-y-4">
      <Link
        href="/balances"
        className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"
      >
        <ArrowLeft size={14} />
        {t("balances.title")}
      </Link>

      <div>
        <h1 className="tet-page-title inline-flex items-center gap-2">
          <QrCode size={24} className="text-emerald-600 dark:text-amber-400" />
          {t("balances.paynowTitle")}
        </h1>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          {t("balances.paynowPayTo", { name: memberName })}
          {amount != null && amount > 0 && (
            <>
              <span className="mx-1 text-gray-400" aria-hidden>
                ·
              </span>
              <span className="font-semibold text-orange-600 dark:text-orange-400">
                {formatCurrency(amount, "SGD")}
              </span>
            </>
          )}
        </p>
        {fromName && (
          <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
            {t("balances.paynowFrom", { name: fromName })}
          </p>
        )}
      </div>

      {!paynowMobile || !payload ? (
        <div className="tet-empty">
          <p className="font-medium">{t("balances.paynowMissing", { name: memberName })}</p>
        </div>
      ) : (
        <div className="tet-card flex flex-col items-center gap-3 p-5">
          <PayNowQrImage
            payload={payload}
            size={260}
            alt={t("balances.paynowQrAlt", {
              name: memberName,
              amount:
                amount != null && amount > 0
                  ? formatCurrency(amount, "SGD")
                  : t("balances.paynowAnyAmount"),
            })}
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
              onClick={() => void handleSaveQr()}
              disabled={saving}
              className="tet-btn-ghost min-h-10 flex-1 text-xs inline-flex items-center justify-center gap-1 disabled:opacity-50"
            >
              {saving ? (
                <Loader2 size={14} className="animate-spin" />
              ) : savedFlash ? (
                <Check size={14} />
              ) : (
                <Download size={14} />
              )}
              {savedFlash ? t("balances.paynowSaved") : t("balances.paynowSaveQr")}
            </button>
            <button
              type="button"
              onClick={() => void copyMobile()}
              className="tet-btn-ghost min-h-10 flex-1 text-xs inline-flex items-center justify-center gap-1"
            >
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? t("balances.paynowCopied") : t("balances.paynowCopyMobile")}
            </button>
          </div>
          {saveError && (
            <p className="text-center text-xs text-red-600 dark:text-red-400">{saveError}</p>
          )}
          <PayNowBankSheet
            open={bankSheetOpen}
            paynowMobile={paynowMobile}
            amount={amount}
            onClose={() => setBankSheetOpen(false)}
          />
        </div>
      )}
    </div>
  );
}
