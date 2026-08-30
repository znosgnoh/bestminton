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

/** Positive net = owed to this member (Splitwise / creditor position). */
export function netsFromRemainders(
  items: Array<{ debtorId: number; creditorId: number; remainder: number }>
): Array<{ memberId: number; net: number }> {
  const cents = new Map<number, number>();
  function add(id: number, delta: number) {
    cents.set(id, (cents.get(id) ?? 0) + delta);
  }
  for (const item of items) {
    const c = toCents(item.remainder);
    if (c <= 0) continue;
    add(item.debtorId, -c);
    add(item.creditorId, c);
  }
  return [...cents.entries()]
    .filter(([, n]) => n !== 0)
    .map(([memberId, n]) => ({ memberId, net: fromCents(n) }));
}

/**
 * Opening leftover = current Splitwise nets minus MATCH/SHUTTLECOCK already on the ledger,
 * so re-import during dual-write does not double-count settled sessions.
 */
export function subtractLedgerNetsFromSplitwise(
  splitwiseNets: Array<{ memberId: number; net: number }>,
  ledgerNets: Array<{ memberId: number; net: number }>
): Array<{ memberId: number; net: number }> {
  const cents = new Map<number, number>();
  for (const n of splitwiseNets) {
    cents.set(n.memberId, (cents.get(n.memberId) ?? 0) + toCents(n.net));
  }
  for (const n of ledgerNets) {
    cents.set(n.memberId, (cents.get(n.memberId) ?? 0) - toCents(n.net));
  }
  return [...cents.entries()].map(([memberId, n]) => ({
    memberId,
    net: fromCents(n),
  }));
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
