import { netBilateralDebts, type DebtEdge } from "./drinkDebtUtils";

export type LedgerRemainder = {
  debtorId: number;
  creditorId: number;
  remainder: number;
};

export type FifoShare = {
  id: number;
  debtorId: number;
  creditorId: number;
  owed: number;
  paid: number;
  createdAt: string;
};

export function toCents(n: number): number {
  return Math.round(n * 100);
}

export function fromCents(c: number): number {
  return Math.round(c) / 100;
}

export function remaindersToEdges(items: LedgerRemainder[]): DebtEdge[] {
  return items
    .filter((i) => i.remainder > 0 && i.debtorId !== i.creditorId)
    .map((i) => ({
      debtorId: i.debtorId,
      creditorId: i.creditorId,
      amount: fromCents(toCents(i.remainder)),
    }));
}

/**
 * Display + mark-paid edges: net A↔B only.
 * Do not collapse A→B→C — FIFO mark-paid only writes the direct pair, and
 * shuttlecock remittance would otherwise invent unpayable “via other players” rows.
 */
export function ledgerSimplifiedEdges(items: LedgerRemainder[]): DebtEdge[] {
  return netBilateralDebts(remaindersToEdges(items))
    .map((edge) => ({
      ...edge,
      amount: fromCents(toCents(edge.amount)),
    }))
    .filter((edge) => edge.amount > 0);
}

export function applyMarkPaidFifo(shares: FifoShare[], amount: number): FifoShare[] {
  let remaining = toCents(amount);
  if (remaining <= 0) return shares.map((s) => ({ ...s }));

  const ordered = [...shares].sort((a, b) => {
    const t = a.createdAt.localeCompare(b.createdAt);
    return t !== 0 ? t : a.id - b.id;
  });

  return ordered.map((s) => {
    const due = toCents(s.owed) - toCents(s.paid);
    if (remaining <= 0 || due <= 0) return { ...s };
    const apply = Math.min(due, remaining);
    remaining -= apply;
    return { ...s, paid: fromCents(toCents(s.paid) + apply) };
  });
}

export function expenseStatus(
  shares: Array<{ owed: number; paid: number }>
): "OPEN" | "SETTLED" {
  if (shares.length === 0) return "SETTLED";
  return shares.every((s) => toCents(s.paid) >= toCents(s.owed)) ? "SETTLED" : "OPEN";
}
