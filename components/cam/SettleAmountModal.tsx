"use client";

import { useEffect, useState } from "react";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { useI18n } from "@/contexts/LocaleContext";

interface SettleAmountModalProps {
  open: boolean;
  maxAmount: number;
  oweName: string;
  ownName: string;
  onSubmit: (amount: number) => void;
  onCancel: () => void;
}

export default function SettleAmountModal({
  open,
  maxAmount,
  oweName,
  ownName,
  onSubmit,
  onCancel,
}: SettleAmountModalProps) {
  const { t } = useI18n();
  const [amount, setAmount] = useState(maxAmount);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setAmount(maxAmount);
      setError(null);
    }
  }, [open, maxAmount]);

  if (!open) return null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const value = Math.floor(Number(amount));
    if (!Number.isInteger(value) || value < 1 || value > maxAmount) {
      setError(t("cam.settleAmountError", { max: maxAmount }));
      return;
    }
    onSubmit(value);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onCancel}
    >
      <div
        className="tet-card w-full max-w-sm p-6 shadow-xl ring-amber-200/60 dark:ring-amber-900/40"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="tet-section-title">{t("cam.settleTitle")}</h3>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          <span className="font-medium text-gray-900 dark:text-gray-100">{oweName}</span>
          <span className="mx-1" aria-hidden>
            →
          </span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{ownName}</span>
          <span className="mx-1 text-gray-400" aria-hidden>
            ·
          </span>
          <span className="inline-flex items-center gap-0.5 font-semibold text-orange-600 dark:text-orange-400">
            <OrangeJuiceIcon size={12} className="shrink-0" />
            {t("cam.settleMax", { amount: maxAmount })}
          </span>
        </p>
        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div>
            <label htmlFor="settle-amount" className="tet-label">
              {t("cam.settleAmount")}
            </label>
            <input
              id="settle-amount"
              type="number"
              inputMode="numeric"
              min={1}
              max={maxAmount}
              step={1}
              value={amount}
              onChange={(e) => {
                setAmount(Number(e.target.value));
                setError(null);
              }}
              className="tet-input-lg mt-1 w-full"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="tet-btn-ghost min-h-11 flex-1"
            >
              {t("common.cancel")}
            </button>
            <button type="submit" className="tet-btn-primary min-h-11 flex-1">
              {t("common.confirm")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
