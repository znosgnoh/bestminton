import { type DebtEdge } from "./drinkDebtUtils";
import { fromCents, toCents } from "./ledgerMath";

export function parseGroupMemberNet(
  balances: Array<{ amount: string; currency_code: string }>,
  currency: string
): number {
  const row = balances.find((b) => b.currency_code === currency);
  if (!row) return 0;
  const n = Number(row.amount);
  return Number.isFinite(n) ? n : 0;
}

export function openingPairsFromNets(
  nets: Array<{ memberId: number; net: number }>
): DebtEdge[] {
  const debtors = nets
    .filter((n) => n.net < -0.005)
    .map((n) => ({ id: n.memberId, amount: toCents(-n.net) }))
    .sort((a, b) => b.amount - a.amount || a.id - b.id);
  const creditors = nets
    .filter((n) => n.net > 0.005)
    .map((n) => ({ id: n.memberId, amount: toCents(n.net) }))
    .sort((a, b) => b.amount - a.amount || a.id - b.id);

  const result: DebtEdge[] = [];
  let i = 0;
  let j = 0;
  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    if (transfer > 0) {
      result.push({
        debtorId: debtors[i].id,
        creditorId: creditors[j].id,
        amount: fromCents(transfer),
      });
    }
    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }
  return result.sort((a, b) => b.amount - a.amount || a.debtorId - b.debtorId);
}
