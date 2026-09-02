import { Prisma } from "@prisma/client";
import { db } from "./db";
import type {
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

    const debited = await client.member.updateMany({
      where: { id: fromMemberId, ojBalance: { gte: requested } },
      data: { ojBalance: { decrement: requested } },
    });
    if (debited.count === 0) {
      throw Object.assign(new Error("Insufficient balance."), { code: "INSUFFICIENT" });
    }
    const credited = await client.member.updateMany({
      where: { id: toMemberId, ojBalance: { lte: -requested } },
      data: { ojBalance: { increment: requested } },
    });
    if (credited.count === 0) {
      throw Object.assign(new Error("Insufficient balance."), { code: "INSUFFICIENT" });
    }

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
    const claimed = await client.drinkSettleTransaction.updateMany({
      where: { id: transactionId, rolledBackAt: null },
      data: { rolledBackAt: new Date() },
    });
    if (claimed.count === 0) {
      const existing = await client.drinkSettleTransaction.findUnique({
        where: { id: transactionId },
      });
      if (!existing) {
        throw Object.assign(new Error("Transaction not found."), { code: "NOT_FOUND" });
      }
      throw Object.assign(new Error("Already rolled back."), { code: "ALREADY_ROLLED_BACK" });
    }

    const row = await client.drinkSettleTransaction.findUniqueOrThrow({
      where: { id: transactionId },
      include: {
        fromMember: { select: { name: true } },
        toMember: { select: { name: true } },
      },
    });

    await client.member.update({
      where: { id: row.fromMemberId },
      data: { ojBalance: { increment: row.amount } },
    });
    await client.member.update({
      where: { id: row.toMemberId },
      data: { ojBalance: { decrement: row.amount } },
    });

    await assertOjChecksum(client);
    return toTxDto(row);
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
