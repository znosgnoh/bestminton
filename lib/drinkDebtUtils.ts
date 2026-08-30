export type DebtEdge = { debtorId: number; creditorId: number; amount: number };

/** Net bilateral debts between each pair: if A owes B 5 and B owes A 2, result is A owes B 3. */
export function netBilateralDebts(debts: Array<DebtEdge>): Array<DebtEdge> {
  // Accumulate in integer cents so equal opposite money debts cancel cleanly
  // (e.g. 45.00 vs 1.58+15.88+… must not leave float dust like 1e-15).
  const pairNetCents = new Map<string, number>();

  for (const d of debts) {
    const cents = Math.round(d.amount * 100);
    if (cents <= 0 || d.debtorId === d.creditorId) continue;
    const low = Math.min(d.debtorId, d.creditorId);
    const high = Math.max(d.debtorId, d.creditorId);
    const key = `${low}:${high}`;
    const signed = d.debtorId === low ? cents : -cents;
    pairNetCents.set(key, (pairNetCents.get(key) ?? 0) + signed);
  }

  const result: Array<DebtEdge> = [];
  for (const [key, netCents] of pairNetCents) {
    if (netCents === 0) continue;
    const [low, high] = key.split(":").map(Number);
    if (netCents > 0) {
      result.push({ debtorId: low, creditorId: high, amount: netCents / 100 });
    } else {
      result.push({ debtorId: high, creditorId: low, amount: -netCents / 100 });
    }
  }

  return result;
}

/**
 * Greedy net-balance settlement: collapses chains (A→B→C becomes A→C when nets allow)
 * and minimizes the number of displayed payments. Display-only; raw ledger unchanged.
 * Caller should pass a single connected component — cross-group pairing is incorrect.
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

/**
 * Split edges into connected components (undirected: A→B links A and B).
 * Auto-balance must not invent payments across unrelated groups.
 */
export function partitionByConnectedComponent(debts: Array<DebtEdge>): Array<DebtEdge[]> {
  const active = debts.filter((d) => d.amount > 0 && d.debtorId !== d.creditorId);
  if (active.length === 0) return [];

  const adj = new Map<number, number[]>();
  function link(a: number, b: number) {
    const aList = adj.get(a) ?? [];
    aList.push(b);
    adj.set(a, aList);
    const bList = adj.get(b) ?? [];
    bList.push(a);
    adj.set(b, bList);
  }
  for (const d of active) {
    link(d.debtorId, d.creditorId);
  }

  const visited = new Set<number>();
  const memberComponents: number[][] = [];
  for (const id of adj.keys()) {
    if (visited.has(id)) continue;
    const group: number[] = [];
    const queue = [id];
    visited.add(id);
    while (queue.length > 0) {
      const cur = queue.shift()!;
      group.push(cur);
      for (const next of adj.get(cur) ?? []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
    memberComponents.push(group);
  }

  const componentIndex = new Map<number, number>();
  memberComponents.forEach((members, index) => {
    for (const m of members) componentIndex.set(m, index);
  });

  const buckets: DebtEdge[][] = memberComponents.map(() => []);
  for (const d of active) {
    const index = componentIndex.get(d.debtorId);
    if (index === undefined) continue;
    buckets[index].push(d);
  }
  return buckets.filter((b) => b.length > 0);
}

/**
 * Bilateral net per pair, then chain / net-balance minimization **within each
 * connected component only** — never invents A→C across unrelated debt groups.
 */
export function simplifyDebts(debts: Array<DebtEdge>): Array<DebtEdge> {
  const bilateraled = netBilateralDebts(debts);
  const components = partitionByConnectedComponent(bilateraled);
  const simplified = components.flatMap((component) => minimizeDebtTransactions(component));
  return simplified.sort((a, b) => b.amount - a.amount || a.debtorId - b.debtorId);
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

/** Pairwise amount for a directed edge, or 0 if missing. */
export function pairwiseAmount(
  ledger: Array<DebtEdge>,
  debtorId: number,
  creditorId: number
): number {
  const row = ledger.find((d) => d.debtorId === debtorId && d.creditorId === creditorId);
  return row && row.amount > 0 ? row.amount : 0;
}

/**
 * True when a raw pairwise row covers the full displayed amount
 * (same direction and amount ≥ edge.amount).
 */
export function isDirectPairwiseDebt(
  ledger: Array<DebtEdge>,
  edge: DebtEdge
): boolean {
  return pairwiseAmount(ledger, edge.debtorId, edge.creditorId) >= edge.amount;
}

/** True when a debt path exists with positive capacity from debtor to creditor. */
export function canPathSettle(
  ledger: Array<DebtEdge>,
  debtorId: number,
  creditorId: number
): boolean {
  const path = findDebtPath(ledger, debtorId, creditorId);
  if (!path || path.length < 2) return false;
  return debtAmountOnPath(ledger, path) > 0;
}

/**
 * Suggested edge can be settled safely: either fully covered by a pairwise row,
 * or there is a positive-capacity path in the recorded ledger.
 */
export function isSettleableSuggestedEdge(
  ledger: Array<DebtEdge>,
  edge: DebtEdge
): boolean {
  if (edge.amount <= 0 || edge.debtorId === edge.creditorId) return false;
  return (
    isDirectPairwiseDebt(ledger, edge) ||
    canPathSettle(ledger, edge.debtorId, edge.creditorId)
  );
}

/** Net token balance per member: positive = owed cam, negative = owes cam. */
export function netBalancesByMember(
  debts: Array<DebtEdge>
): Array<{ memberId: number; net: number }> {
  const balances = new Map<number, number>();
  for (const d of debts) {
    if (d.amount <= 0 || d.debtorId === d.creditorId) continue;
    balances.set(d.debtorId, (balances.get(d.debtorId) ?? 0) - d.amount);
    balances.set(d.creditorId, (balances.get(d.creditorId) ?? 0) + d.amount);
  }
  return [...balances.entries()]
    .map(([memberId, net]) => ({ memberId, net }))
    .filter((e) => e.net !== 0)
    .sort((a, b) => Math.abs(b.net) - Math.abs(a.net) || a.memberId - b.memberId);
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
