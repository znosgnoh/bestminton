import { Prisma } from "@prisma/client";
import { db } from "./db";
import type {
  DrinkDebtDTO,
  DrinkSettleTransactionDTO,
  MemberDebtSummary,
  OjBalanceDTO,
  OjPoolSnapshotDTO,
  SettleOjResult,
} from "./types";

type Tx = Prisma.TransactionClient;

export function summaryFromOjBalance(ojBalance: number): MemberDebtSummary {
  const totalOwing = Math.max(ojBalance, 0);
  const totalOwed = Math.max(-ojBalance, 0);
  return { totalOwed, totalOwing, netCam: ojBalance };
}

export function maxSettleAmount(fromBalance: number, toBalance: number): number {
  if (fromBalance <= 0 || toBalance >= 0) return 0;
  return Math.min(fromBalance, -toBalance);
}

export async function assertOjChecksum(client: Tx = db): Promise<void> {
  const agg = await client.member.aggregate({ _sum: { ojBalance: true } });
  const sum = agg._sum.ojBalance ?? 0;
  if (sum !== 0) {
    throw new Error(`ojBalance checksum ${sum} != 0`);
  }
}

/** Resolve-style transfer: debtor loses OJ (more negative), creditor gains (more positive). */
export async function transferOj(
  debtorId: number,
  creditorId: number,
  amount: number,
  tx: Tx
): Promise<void> {
  if (debtorId === creditorId || amount <= 0) return;
  await tx.member.update({
    where: { id: debtorId },
    data: { ojBalance: { decrement: amount } },
  });
  await tx.member.update({
    where: { id: creditorId },
    data: { ojBalance: { increment: amount } },
  });
}

function toTxDto(row: {
  id: number;
  fromMemberId: number;
  toMemberId: number;
  amount: number;
  createdAt: Date;
  rolledBackAt: Date | null;
  fromMember: { name: string };
  toMember: { name: string };
}): DrinkSettleTransactionDTO {
  return {
    id: row.id,
    fromMemberId: row.fromMemberId,
    toMemberId: row.toMemberId,
    fromName: row.fromMember.name,
    toName: row.toMember.name,
    amount: row.amount,
    createdAt: row.createdAt.toISOString(),
    rolledBackAt: row.rolledBackAt?.toISOString() ?? null,
  };
}

export async function settleOjPool(
  input: { fromMemberId: number; toMemberId: number; amount?: number },
  tx?: Tx
): Promise<SettleOjResult> {
  const run = async (client: Tx): Promise<SettleOjResult> => {
    const { fromMemberId, toMemberId } = input;
    if (fromMemberId === toMemberId) {
      throw Object.assign(new Error("Cannot settle with self."), { code: "SAME_MEMBER" });
    }

    const [from, to] = await Promise.all([
      client.member.findUniqueOrThrow({ where: { id: fromMemberId } }),
      client.member.findUniqueOrThrow({ where: { id: toMemberId } }),
    ]);

    const max = maxSettleAmount(from.ojBalance, to.ojBalance);
    const requested =
      input.amount == null ? max : Math.max(0, Math.floor(input.amount));
    if (max <= 0 || requested <= 0) {
      throw Object.assign(new Error("No settleable amount."), {
        code: "NO_BALANCE",
      });
    }
    if (requested > max) {
      throw Object.assign(new Error("amount exceeds max settle"), {
        code: "INSUFFICIENT",
        max,
      });
    }

    await client.member.update({
      where: { id: fromMemberId },
      data: { ojBalance: { decrement: requested } },
    });
    await client.member.update({
      where: { id: toMemberId },
      data: { ojBalance: { increment: requested } },
    });

    const row = await client.drinkSettleTransaction.create({
      data: {
        fromMemberId,
        toMemberId,
        amount: requested,
      },
      include: {
        fromMember: { select: { name: true } },
        toMember: { select: { name: true } },
      },
    });

    await assertOjChecksum(client);

    return {
      settled: requested,
      remaining: 0,
      transaction: toTxDto(row),
    };
  };

  if (tx) return run(tx);
  return db.$transaction(run);
}

export async function rollbackOjSettle(
  transactionId: number,
  tx?: Tx
): Promise<DrinkSettleTransactionDTO> {
  const run = async (client: Tx) => {
    const row = await client.drinkSettleTransaction.findUnique({
      where: { id: transactionId },
      include: {
        fromMember: { select: { name: true } },
        toMember: { select: { name: true } },
      },
    });
    if (!row) {
      throw Object.assign(new Error("Transaction not found."), { code: "NOT_FOUND" });
    }
    if (row.rolledBackAt) {
      throw Object.assign(new Error("Already rolled back."), { code: "ALREADY_ROLLED_BACK" });
    }

    await client.member.update({
      where: { id: row.fromMemberId },
      data: { ojBalance: { increment: row.amount } },
    });
    await client.member.update({
      where: { id: row.toMemberId },
      data: { ojBalance: { decrement: row.amount } },
    });

    const updated = await client.drinkSettleTransaction.update({
      where: { id: transactionId },
      data: { rolledBackAt: new Date() },
      include: {
        fromMember: { select: { name: true } },
        toMember: { select: { name: true } },
      },
    });

    await assertOjChecksum(client);
    return toTxDto(updated);
  };

  if (tx) return run(tx);
  return db.$transaction(run);
}

export async function getAllDebtSummaries(): Promise<Map<number, MemberDebtSummary>> {
  const members = await db.member.findMany({ select: { id: true, ojBalance: true } });
  const map = new Map<number, MemberDebtSummary>();
  for (const m of members) {
    map.set(m.id, summaryFromOjBalance(m.ojBalance));
  }
  return map;
}

export function debtSummaryFor(
  memberId: number,
  summaries: Map<number, MemberDebtSummary>
): MemberDebtSummary {
  return summaries.get(memberId) ?? { totalOwed: 0, totalOwing: 0, netCam: 0 };
}

/**
 * Legacy cam API projection. Pool balances have no canonical pairwise edges, so pair
 * debtors and creditors deterministically until Tasks 4/5 consume the pool DTO directly.
 */
export async function getAllDebts(): Promise<DrinkDebtDTO[]> {
  const members = await db.member.findMany({
    where: { ojBalance: { not: 0 } },
    select: { id: true, name: true, ojBalance: true },
    orderBy: { id: "asc" },
  });
  const debtors = members
    .filter((member) => member.ojBalance < 0)
    .map((member) => ({ ...member, remaining: -member.ojBalance }));
  const creditors = members
    .filter((member) => member.ojBalance > 0)
    .map((member) => ({ ...member, remaining: member.ojBalance }));
  const debts: DrinkDebtDTO[] = [];
  const projectedAt = new Date().toISOString();
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.remaining, creditor.remaining);
    debts.push({
      debtorId: debtor.id,
      creditorId: creditor.id,
      amount,
      debtorName: debtor.name,
      creditorName: creditor.name,
      updatedAt: projectedAt,
    });
    debtor.remaining -= amount;
    creditor.remaining -= amount;
    if (debtor.remaining === 0) debtorIndex++;
    if (creditor.remaining === 0) creditorIndex++;
  }

  return debts;
}

/** @deprecated Compatibility for the member debts endpoint until its pool migration. */
export async function getMemberDebts(memberId: number): Promise<{
  owes: DrinkDebtDTO[];
  owedBy: DrinkDebtDTO[];
  summary: MemberDebtSummary;
}> {
  const [debts, member] = await Promise.all([
    getAllDebts(),
    db.member.findUnique({ where: { id: memberId }, select: { ojBalance: true } }),
  ]);
  return {
    owes: debts.filter((debt) => debt.debtorId === memberId),
    owedBy: debts.filter((debt) => debt.creditorId === memberId),
    summary: summaryFromOjBalance(member?.ojBalance ?? 0),
  };
}

export async function getOjPoolSnapshot(): Promise<OjPoolSnapshotDTO> {
  const members = await db.member.findMany({
    where: { ojBalance: { not: 0 } },
    select: { id: true, name: true, avatarUrl: true, ojBalance: true },
    orderBy: [{ ojBalance: "desc" }, { name: "asc" }],
  });
  const transactions = await db.drinkSettleTransaction.findMany({
    include: {
      fromMember: { select: { name: true } },
      toMember: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return {
    balances: members.map(
      (m): OjBalanceDTO => ({
        memberId: m.id,
        name: m.name,
        avatarUrl: m.avatarUrl,
        ojBalance: m.ojBalance,
      })
    ),
    transactions: transactions.map(toTxDto),
  };
}
