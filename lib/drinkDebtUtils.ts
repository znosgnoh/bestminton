export type DebtEdge = { debtorId: number; creditorId: number; amount: number };

/** Net bilateral debts between each pair: if A owes B 5 and B owes A 2, result is A owes B 3. */
export function netBilateralDebts(debts: Array<DebtEdge>): Array<DebtEdge> {
  const pairNet = new Map<string, number>();

  for (const d of debts) {
    if (d.amount <= 0 || d.debtorId === d.creditorId) continue;
    const low = Math.min(d.debtorId, d.creditorId);
    const high = Math.max(d.debtorId, d.creditorId);
    const key = `${low}:${high}`;
    const signed = d.debtorId === low ? d.amount : -d.amount;
    pairNet.set(key, (pairNet.get(key) ?? 0) + signed);
  }

  const result: Array<DebtEdge> = [];
  for (const [key, net] of pairNet) {
    if (net === 0) continue;
    const [low, high] = key.split(":").map(Number);
    if (net > 0) {
      result.push({ debtorId: low, creditorId: high, amount: net });
    } else {
      result.push({ debtorId: high, creditorId: low, amount: -net });
    }
  }

  return result;
}

/**
 * Greedy net-balance settlement: collapses chains (A→B→C becomes A→C when nets allow)
 * and minimizes the number of displayed payments. Display-only; raw ledger unchanged.
 */
export function minimizeDebtTransactions(debts: Array<DebtEdge>): Array<DebtEdge> {
  const balances = new Map<number, number>();

  for (const d of debts) {
    if (d.amount <= 0 || d.debtorId === d.creditorId) continue;
    balances.set(d.debtorId, (balances.get(d.debtorId) ?? 0) - d.amount);
    balances.set(d.creditorId, (balances.get(d.creditorId) ?? 0) + d.amount);
  }

  const debtors: Array<{ id: number; amount: number }> = [];
  const creditors: Array<{ id: number; amount: number }> = [];

  for (const [id, balance] of balances) {
    if (balance < 0) debtors.push({ id, amount: -balance });
    else if (balance > 0) creditors.push({ id, amount: balance });
  }

  debtors.sort((a, b) => b.amount - a.amount || a.id - b.id);
  creditors.sort((a, b) => b.amount - a.amount || a.id - b.id);

  const result: Array<DebtEdge> = [];
  let i = 0;
  let j = 0;

  while (i < debtors.length && j < creditors.length) {
    const transfer = Math.min(debtors[i].amount, creditors[j].amount);
    if (transfer > 0) {
      result.push({
        debtorId: debtors[i].id,
        creditorId: creditors[j].id,
        amount: transfer,
      });
    }
    debtors[i].amount -= transfer;
    creditors[j].amount -= transfer;
    if (debtors[i].amount === 0) i++;
    if (creditors[j].amount === 0) j++;
  }

  return result.sort((a, b) => b.amount - a.amount || a.debtorId - b.debtorId);
}

/** Bilateral net per pair, then chain / net-balance minimization for display. */
export function simplifyDebts(debts: Array<DebtEdge>): Array<DebtEdge> {
  return minimizeDebtTransactions(netBilateralDebts(debts));
}

/** BFS path from debtor to creditor along outstanding debt edges. */
export function findDebtPath(
  debts: Array<DebtEdge>,
  fromId: number,
  toId: number
): number[] | null {
  if (fromId === toId) return [fromId];

  const adjacency = new Map<number, number[]>();
  for (const d of debts) {
    if (d.amount <= 0) continue;
    const next = adjacency.get(d.debtorId) ?? [];
    next.push(d.creditorId);
    adjacency.set(d.debtorId, next);
  }

  const queue: number[] = [fromId];
  const visited = new Set<number>([fromId]);
  const parent = new Map<number, number>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const next of adjacency.get(current) ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      parent.set(next, current);
      if (next === toId) {
        const path = [toId];
        let node = toId;
        while (parent.has(node)) {
          node = parent.get(node)!;
          path.push(node);
        }
        path.reverse();
        return path;
      }
      queue.push(next);
    }
  }

  return null;
}

export function debtAmountOnPath(debts: Array<DebtEdge>, path: number[]): number {
  if (path.length < 2) return 0;
  let min = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const edge = debts.find((d) => d.debtorId === path[i] && d.creditorId === path[i + 1]);
    if (!edge || edge.amount <= 0) return 0;
    min = Math.min(min, edge.amount);
  }
  return min === Infinity ? 0 : min;
}

export interface MemberDebtTotals {
  memberId: number;
  totalOwes: number;
  totalOwed: number;
}

/** Sum amounts owed and owing per member from a debt list. */
export function totalsByMember(debts: Array<DebtEdge>): Map<number, MemberDebtTotals> {
  const map = new Map<number, MemberDebtTotals>();

  function ensure(id: number): MemberDebtTotals {
    const existing = map.get(id);
    if (existing) return existing;
    const entry = { memberId: id, totalOwes: 0, totalOwed: 0 };
    map.set(id, entry);
    return entry;
  }

  for (const d of debts) {
    if (d.amount <= 0) continue;
    ensure(d.debtorId).totalOwes += d.amount;
    ensure(d.creditorId).totalOwed += d.amount;
  }

  return map;
}

export function splitDebtsForMember<T extends DebtEdge>(
  debts: T[],
  memberId: number
): { owes: T[]; owedBy: T[] } {
  const owes = debts.filter((d) => d.debtorId === memberId);
  const owedBy = debts.filter((d) => d.creditorId === memberId);
  return { owes, owedBy };
}
