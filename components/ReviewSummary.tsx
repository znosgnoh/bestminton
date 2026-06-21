"use client";

import type { CalculatedShare } from "@/lib/types";
import { currencyLabel, formatAmount, formatCurrency } from "@/lib/currency";

interface ReviewSummaryProps {
  shares: CalculatedShare[];
  totalCost: number;
  paidByName: string;
  currencyCode?: string;
  onBack: () => void;
}

export default function ReviewSummary({
  shares,
  totalCost,
  paidByName,
  currencyCode,
  onBack,
}: ReviewSummaryProps) {
  const cur = currencyLabel(currencyCode);
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-amber-200/60 dark:border-amber-900/40 bg-amber-50/60 dark:bg-gray-800/60 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Total cost</span>
          <span className="font-semibold text-gray-900 dark:text-gray-100">{formatCurrency(totalCost, currencyCode)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-gray-600 dark:text-gray-400">Paid by</span>
          <span className="font-medium text-gray-900 dark:text-gray-100">{paidByName}</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-amber-200/60 dark:border-gray-800">
        <table className="w-full text-sm">
          <thead className="bg-amber-50/80 dark:bg-gray-800">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium text-gray-600 dark:text-gray-400">Name</th>
              <th className="px-3 py-2.5 text-center font-medium text-gray-600 dark:text-gray-400">Hrs</th>
              <th className="px-3 py-2.5 text-center font-medium text-gray-600 dark:text-gray-400">+G</th>
              <th className="px-3 py-2.5 text-center font-medium text-gray-600 dark:text-gray-400">Wt</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600 dark:text-gray-400">Owes ({cur})</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-amber-100/50 dark:divide-gray-800">
            {shares.map((s) => (
              <tr key={s.memberId} className="bg-white/90 dark:bg-gray-900/90">
                <td className="px-3 py-3 font-medium text-gray-900 dark:text-gray-100">
                  {s.name}
                </td>
                <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">
                  {s.weight / (1 + 0)}
                </td>
                <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">—</td>
                <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-400">
                  {s.weight.toFixed(1)}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-emerald-700 dark:text-amber-400">
                  {formatAmount(s.owedShare)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-amber-50/80 dark:bg-gray-800">
            <tr>
              <td colSpan={4} className="px-3 py-2.5 font-semibold text-gray-700 dark:text-gray-300">
                Total
              </td>
              <td className="px-3 py-2.5 text-right font-bold text-gray-900 dark:text-gray-100">
                {formatAmount(totalCost)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button onClick={onBack} className="tet-btn-ghost w-full py-3.5 text-base">
        ← Edit Attendance
      </button>
    </div>
  );
}
