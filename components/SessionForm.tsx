"use client";

import { useState } from "react";
import { currencyLabel } from "@/lib/currency";

interface SessionFormProps {
  onSubmit: (totalCost: number) => void;
  currencyCode?: string;
}

export default function SessionForm({ onSubmit, currencyCode }: SessionFormProps) {
  const cur = currencyLabel(currencyCode);
  const [totalCost, setTotalCost] = useState("");
  const [touched, setTouched] = useState(false);

  const costNum = parseFloat(totalCost);
  const costError =
    touched && (totalCost === "" || isNaN(costNum) || costNum <= 0)
      ? "Enter a valid amount greater than 0"
      : null;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (!costError && totalCost !== "") onSubmit(costNum);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-700">
          Total Cost ({cur})
        </label>
        <div className="relative">
          <span
            aria-hidden
            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400"
          >
            {cur}
          </span>
          <input
            type="number"
            inputMode="decimal"
            min="0.01"
            step="0.01"
            placeholder="e.g. 1200"
            value={totalCost}
            onChange={(e) => setTotalCost(e.target.value)}
            onBlur={() => setTouched(true)}
            className={`w-full rounded-xl border py-3.5 pl-9 pr-4 text-base outline-none transition focus:ring-2 focus:ring-emerald-500 ${
              costError ? "border-red-400 bg-red-50" : "border-gray-300 bg-white"
            }`}
          />
        </div>
        {costError && <p className="mt-1 text-xs text-red-600">{costError}</p>}
      </div>

      <button
        type="submit"
        className="w-full rounded-xl bg-emerald-600 py-4 text-base font-semibold text-white transition hover:bg-emerald-700 active:bg-emerald-800"
      >
        Next: Add Participants
      </button>
    </form>
  );
}
