import { Prisma } from "@prisma/client";
import { db } from "./db";
import { simplifyDebts, type DebtEdge } from "./drinkDebtUtils";
import type { DrinkDebtDTO, MemberDebtSummary } from "./types";

export { simplifyDebts } from "./drinkDebtUtils";

type Tx = Prisma.TransactionClient;

const EMPTY_SUMMARY: MemberDebtSummary = { totalOwed: 0, totalOwing: 0, netCam: 0 };

/** Increment pairwise debt: debtor owes creditor `amount` ly nước cam. */
export async function addDebt(
  debtorId: number,
  creditorId: number,
  amount: number,
  tx?: Tx
): Promise<void> {
  if (debtorId === creditorId || amount <= 0) return;

  const client = tx ?? db;
  await client.drinkDebt.upsert({
    where: { debtorId_creditorId: { debtorId, creditorId } },
    create: { debtorId, creditorId, amount },
    update: { amount: { increment: amount } },
  });
}

export async function getAllDebts(): Promise<DrinkDebtDTO[]> {
  const rows = await db.drinkDebt.findMany({
    where: { amount: { gt: 0 } },
    include: {
      debtor: { select: { id: true, name: true } },
      creditor: { select: { id: true, name: true } },
    },
    orderBy: [{ amount: "desc" }, { debtorId: "asc" }],
  });

  return rows.map((r) => ({
    debtorId: r.debtorId,
    creditorId: r.creditorId,
    amount: r.amount,
    debtorName: r.debtor.name,
    creditorName: r.creditor.name,
    updatedAt: r.updatedAt.toISOString(),
  }));
}

export async function getMemberDebts(memberId: number): Promise<{
  owes: DrinkDebtDTO[];
  owedBy: DrinkDebtDTO[];
  summary: MemberDebtSummary;
}> {
  const [owedRows, owingRows] = await Promise.all([
    db.drinkDebt.findMany({
      where: { debtorId: memberId, amount: { gt: 0 } },
      include: {
        debtor: { select: { id: true, name: true } },
        creditor: { select: { id: true, name: true } },
      },
      orderBy: { amount: "desc" },
    }),
    db.drinkDebt.findMany({
      where: { creditorId: memberId, amount: { gt: 0 } },
      include: {
        debtor: { select: { id: true, name: true } },
        creditor: { select: { id: true, name: true } },
      },
      orderBy: { amount: "desc" },
    }),
  ]);

  const toDto = (r: (typeof owedRows)[number]): DrinkDebtDTO => ({
    debtorId: r.debtorId,
    creditorId: r.creditorId,
    amount: r.amount,
    debtorName: r.debtor.name,
    creditorName: r.creditor.name,
    updatedAt: r.updatedAt.toISOString(),
  });

  const owes = owedRows.map(toDto);
  const owedBy = owingRows.map(toDto);
  const totalOwed = owes.reduce((s, d) => s + d.amount, 0);
  const totalOwing = owedBy.reduce((s, d) => s + d.amount, 0);

  return {
    owes,
    owedBy,
    summary: { totalOwed, totalOwing, netCam: totalOwing - totalOwed },
  };
}

/** Batch-compute debt summaries for all members that appear in the ledger. */
export async function getAllDebtSummaries(): Promise<Map<number, MemberDebtSummary>> {
  const rows = await db.drinkDebt.findMany({ where: { amount: { gt: 0 } } });
  const map = new Map<number, MemberDebtSummary>();

  function ensure(id: number): MemberDebtSummary {
    const existing = map.get(id);
    if (existing) return existing;
    const summary = { ...EMPTY_SUMMARY };
    map.set(id, summary);
    return summary;
  }

  for (const row of rows) {
    ensure(row.debtorId).totalOwed += row.amount;
    ensure(row.creditorId).totalOwing += row.amount;
  }

  for (const summary of map.values()) {
    summary.netCam = summary.totalOwing - summary.totalOwed;
  }

  return map;
}

export function debtSummaryFor(
  memberId: number,
  summaries: Map<number, MemberDebtSummary>
): MemberDebtSummary {
  return summaries.get(memberId) ?? EMPTY_SUMMARY;
}

async function loadDebtEdges(client: Tx): Promise<DebtEdge[]> {
  const rows = await client.drinkDebt.findMany({ where: { amount: { gt: 0 } } });
  return rows.map((r) => ({
    debtorId: Number(r.debtorId),
    creditorId: Number(r.creditorId),
    amount: Number(r.amount),
  }));
}

export type SettleDebtResult = {
  settled: number;
  remaining: number;
  reason?: string;
};

/**
 * Realize a synthetic D→C transfer on the raw ledger by reducing D's outgoing
 * edges and C's incoming edges in parallel (matches minimizeDebtTransactions).
 */
async function applyNetTransfer(
  client: Tx,
  debtorId: number,
  creditorId: number,
  amount: number
): Promise<number> {
  let remaining = amount;
  let applied = 0;

  while (remaining > 0) {
    const [outRows, inRows] = await Promise.all([
      client.drinkDebt.findMany({
        where: { debtorId, amount: { gt: 0 } },
        orderBy: { amount: "desc" },
      }),
      client.drinkDebt.findMany({
        where: { creditorId, amount: { gt: 0 } },
        orderBy: { amount: "desc" },
      }),
    ]);

    if (outRows.length === 0 || inRows.length === 0) break;

    const chunk = Math.min(remaining, outRows[0].amount, inRows[0].amount);
    if (chunk <= 0) break;

    const [outStep, inStep] = await Promise.all([
      reduceDebt(debtorId, outRows[0].creditorId, chunk, client),
      reduceDebt(inRows[0].debtorId, creditorId, chunk, client),
    ]);

    if (outStep.settled <= 0 || inStep.settled <= 0) break;

    const step = Math.min(outStep.settled, inStep.settled);
    applied += step;
    remaining -= step;
  }

  return applied;
}

/** Settle a simplified ledger edge when no direct pairwise row exists. */
async function settleViaNetBalance(
  client: Tx,
  debtorId: number,
  creditorId: number,
  targetAmount: number
): Promise<SettleDebtResult> {
  let settled = 0;
  let remaining = targetAmount;

  while (remaining > 0) {
    const ledger = await loadDebtEdges(client);
    const simplifiedEdge = simplifyDebts(ledger).find(
      (d) => d.debtorId === debtorId && d.creditorId === creditorId
    );
    if (!simplifiedEdge || simplifiedEdge.amount <= 0) {
      return {
        settled,
        remaining: targetAmount - settled,
        reason: settled === 0 ? "no_simplified_edge" : undefined,
      };
    }

    const step = Math.min(remaining, simplifiedEdge.amount);
    const applied = await applyNetTransfer(client, debtorId, creditorId, step);
    if (applied <= 0) {
      return {
        settled,
        remaining: targetAmount - settled,
        reason: settled === 0 ? "no_outgoing_or_incoming_edges" : undefined,
      };
    }

    settled += applied;
    remaining -= applied;
  }

  return { settled, remaining: targetAmount - settled };
}

/** Reduce or clear a pairwise debt. Defaults to full settlement when amount is omitted. */
export async function reduceDebt(
  debtorId: number,
  creditorId: number,
  amount?: number,
  tx?: Tx
): Promise<{ settled: number; remaining: number }> {
  if (debtorId === creditorId) {
    return { settled: 0, remaining: 0 };
  }

  const client = tx ?? db;
  const row = await client.drinkDebt.findUnique({
    where: { debtorId_creditorId: { debtorId, creditorId } },
  });

  if (!row || row.amount <= 0) {
    return { settled: 0, remaining: 0 };
  }

  const settleAmount =
    amount === undefined ? row.amount : Math.max(0, Math.min(Math.floor(amount), row.amount));
  if (settleAmount <= 0) {
    return { settled: 0, remaining: row.amount };
  }

  const remaining = row.amount - settleAmount;
  if (remaining <= 0) {
    await client.drinkDebt.delete({
      where: { debtorId_creditorId: { debtorId, creditorId } },
    });
    return { settled: settleAmount, remaining: 0 };
  }

  await client.drinkDebt.update({
    where: { debtorId_creditorId: { debtorId, creditorId } },
    data: { amount: remaining },
  });
  return { settled: settleAmount, remaining };
}

/**
 * Settle a direct or simplified debt edge. Uses the raw pairwise row when present;
 * otherwise routes payment along ledger paths (e.g. A→B + B→C for a displayed A→C).
 */
export async function settleDebtBetween(
  debtorId: number,
  creditorId: number,
  amount?: number,
  tx?: Tx
): Promise<SettleDebtResult> {
  if (debtorId === creditorId) {
    return { settled: 0, remaining: 0, reason: "same_member" };
  }

  const run = async (client: Tx): Promise<SettleDebtResult> => {
    const direct = await reduceDebt(debtorId, creditorId, amount, client);
    if (direct.settled > 0) {
      return direct;
    }

    const ledger = await loadDebtEdges(client);
    const simplifiedEdge = simplifyDebts(ledger).find(
      (d) => d.debtorId === debtorId && d.creditorId === creditorId
    );

    let targetAmount: number;
    if (amount == null) {
      targetAmount = simplifiedEdge?.amount ?? 0;
    } else {
      targetAmount = Math.max(0, Math.floor(amount));
      if (simplifiedEdge) {
        targetAmount = Math.min(targetAmount, simplifiedEdge.amount);
      }
    }

    if (targetAmount <= 0) {
      return {
        settled: 0,
        remaining: 0,
        reason: simplifiedEdge ? "zero_target_amount" : "no_simplified_edge",
      };
    }

    const synthetic = await settleViaNetBalance(client, debtorId, creditorId, targetAmount);
    if (synthetic.settled > 0) {
      return synthetic;
    }

    return {
      settled: 0,
      remaining: targetAmount,
      reason: synthetic.reason ?? "settlement_failed",
    };
  };

  if (tx) return run(tx);
  return db.$transaction(run);
}
