"use client";

import type { CalculatedShare } from "@/lib/types";

interface ReviewSummaryProps {
  shares: CalculatedShare[];
  totalCost: number;
  paidByName: string;
  onBack: () => void;
}

function fmt(n: number) {
  return n.toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ReviewSummary({
  shares,
  totalCost,
  paidByName,
  onBack,
}: ReviewSummaryProps) {
  return (
    <div className="space-y-4">
      {/* Session meta */}
      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-500">Total cost</span>
          <span className="font-semibold text-gray-800">฿{fmt(totalCost)}</span>
        </div>
        <div className="mt-1 flex justify-between">
          <span className="text-gray-500">Paid by</span>
          <span className="font-medium text-gray-800">{paidByName}</span>
        </div>
      </div>

      {/* Split table */}
      <div className="overflow-hidden rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead className="bg-gray-100">
            <tr>
              <th className="px-3 py-2.5 text-left font-medium text-gray-600">Name</th>
              <th className="px-3 py-2.5 text-center font-medium text-gray-600">Hrs</th>
              <th className="px-3 py-2.5 text-center font-medium text-gray-600">+G</th>
              <th className="px-3 py-2.5 text-center font-medium text-gray-600">Wt</th>
              <th className="px-3 py-2.5 text-right font-medium text-gray-600">Owes (฿)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shares.map((s) => (
              <tr key={s.memberId} className="bg-white">
                <td className="px-3 py-3 font-medium text-gray-800">
                  {s.name}
                </td>
                <td className="px-3 py-3 text-center text-gray-600">
                  {s.weight / (1 + 0) /* display weight only */}
                </td>
                <td className="px-3 py-3 text-center text-gray-600">—</td>
                <td className="px-3 py-3 text-center text-gray-600">
                  {s.weight.toFixed(1)}
                </td>
                <td className="px-3 py-3 text-right font-semibold text-emerald-700">
                  {fmt(s.owedShare)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-gray-100">
            <tr>
              <td colSpan={4} className="px-3 py-2.5 font-semibold text-gray-700">
                Total
              </td>
              <td className="px-3 py-2.5 text-right font-bold text-gray-900">
                {fmt(totalCost)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <button
        onClick={onBack}
        className="w-full rounded-xl border border-gray-300 py-3.5 text-base font-medium text-gray-700 transition hover:bg-gray-50 active:bg-gray-100"
      >
        ← Edit Attendance
      </button>
    </div>
  );
}
