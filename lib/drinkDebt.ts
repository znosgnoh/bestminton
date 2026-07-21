import { Prisma } from "@prisma/client";
import { db } from "./db";
import {
  debtAmountOnPath,
  findDebtPath,
  simplifyDebts,
  type DebtEdge,
} from "./drinkDebtUtils";
import type { DrinkDebtDTO, MemberDebtSummary, SettleDebtResult } from "./types";

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
  const rows = await db.drinkDebt.findMany({
    where: {
      amount: { gt: 0 },
      OR: [{ debtorId: memberId }, { creditorId: memberId }],
    },
    include: {
      debtor: { select: { id: true, name: true } },
      creditor: { select: { id: true, name: true } },
    },
    orderBy: { amount: "desc" },
  });

  const toDto = (r: (typeof rows)[number]): DrinkDebtDTO => ({
    debtorId: r.debtorId,
    creditorId: r.creditorId,
    amount: r.amount,
    debtorName: r.debtor.name,
    creditorName: r.creditor.name,
    updatedAt: r.updatedAt.toISOString(),
  });

  const owedRows = rows.filter((r) => r.debtorId === memberId);
  const owingRows = rows.filter((r) => r.creditorId === memberId);

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

/**
 * Settle along a recorded ledger path (BFS). Reduces every edge on the path
 * by the same step. Refuses when no path exists — never invents cross-component cuts.
 * `remaining` is always unfulfilled amount of this request.
 */
async function settleViaPath(
  client: Tx,
  debtorId: number,
  creditorId: number,
  targetAmount: number
): Promise<SettleDebtResult> {
  let settled = 0;
  let remaining = targetAmount;

  while (remaining > 0) {
    const ledger = await loadDebtEdges(client);
    const path = findDebtPath(ledger, debtorId, creditorId);
    if (!path || path.length < 2) {
      return {
        settled,
        remaining,
        reason: settled === 0 ? "no_path" : "partial_no_path",
      };
    }

    const capacity = debtAmountOnPath(ledger, path);
    if (capacity <= 0) {
      return {
        settled,
        remaining,
        reason: settled === 0 ? "no_path" : "partial_no_path",
      };
    }

    const step = Math.min(remaining, capacity);
    for (let i = 0; i < path.length - 1; i++) {
      const edgeResult = await reduceDebt(path[i], path[i + 1], step, client);
      if (edgeResult.settled < step) {
        return {
          settled,
          remaining: targetAmount - settled,
          reason: "path_edge_mismatch",
        };
      }
    }

    settled += step;
    remaining -= step;
  }

  return { settled, remaining: 0 };
}

/**
 * Reduce or clear a pairwise debt. Defaults to full settlement when amount is omitted.
 * Note: `remaining` here is leftover on the pairwise row (internal), not request remaining.
 */
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

  const pairwiseRemaining = row.amount - settleAmount;
  if (pairwiseRemaining <= 0) {
    await client.drinkDebt.delete({
      where: { debtorId_creditorId: { debtorId, creditorId } },
    });
    return { settled: settleAmount, remaining: 0 };
  }

  await client.drinkDebt.update({
    where: { debtorId_creditorId: { debtorId, creditorId } },
    data: { amount: pairwiseRemaining },
  });
  return { settled: settleAmount, remaining: pairwiseRemaining };
}

/**
 * Settle a debt edge for `amount` (or the simplified/pairwise total when omitted).
 * 1) Reduce direct pairwise as much as possible.
 * 2) Settle any remainder along recorded paths (A→B→C).
 * Refuses cross-component netting with no path.
 * `remaining` = unfulfilled portion of this request.
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
    const ledger = await loadDebtEdges(client);
    const simplifiedEdge = simplifyDebts(ledger).find(
      (d) => d.debtorId === debtorId && d.creditorId === creditorId
    );
    const pairwise = ledger.find(
      (d) => d.debtorId === debtorId && d.creditorId === creditorId
    );
    const pairwiseAmt = pairwise && pairwise.amount > 0 ? pairwise.amount : 0;

    let targetAmount: number;
    if (amount == null) {
      targetAmount = simplifiedEdge?.amount ?? pairwiseAmt;
    } else {
      targetAmount = Math.max(0, Math.floor(amount));
    }

    if (targetAmount <= 0) {
      return { settled: 0, remaining: 0, reason: "zero_target_amount" };
    }

    let settled = 0;
    let stillNeeded = targetAmount;

    if (stillNeeded > 0 && pairwiseAmt > 0) {
      const direct = await reduceDebt(debtorId, creditorId, stillNeeded, client);
      settled += direct.settled;
      stillNeeded -= direct.settled;
    }

    if (stillNeeded > 0) {
      const pathResult = await settleViaPath(client, debtorId, creditorId, stillNeeded);
      settled += pathResult.settled;
      stillNeeded -= pathResult.settled;

      if (settled === 0) {
        return {
          settled: 0,
          remaining: targetAmount,
          reason: pathResult.reason ?? "no_path",
        };
      }
    }

    return {
      settled,
      remaining: stillNeeded,
      reason: stillNeeded > 0 ? "partial_no_path" : undefined,
    };
  };

  if (tx) return run(tx);
  return db.$transaction(run);
}
