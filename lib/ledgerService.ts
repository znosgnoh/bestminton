import { Prisma } from "@prisma/client";
import { calculateShares } from "./calculations";
import { getCurrencyCode } from "./currency";
import { db } from "./db";
import { expenseStatus, fromCents, ledgerSimplifiedEdges, toCents } from "./ledgerMath";
import { MATCH_FULL_INCLUDE } from "./prismaIncludes";
import { isSplitwiseConfigured } from "./splitwise";
import {
  formatShuttlecockRemittanceDescription,
  shouldCreateShuttlecockRemittance,
  splitSettlementFees,
} from "./shuttlecock";
import type {
  LedgerEdgeDTO,
  LedgerExpenseDTO,
  LedgerExpenseShareDTO,
  LedgerSnapshotDTO,
  RecordMatchLedgerResponse,
  RegistrationDTO,
} from "./types";

const EXPENSE_INCLUDE = {
  paidBy: { select: { id: true, name: true } },
  shares: {
    include: { member: { select: { id: true, name: true } } },
    orderBy: { id: "asc" as const },
  },
} as const;

const MATCH_LEDGER_INCLUDE = {
  ...MATCH_FULL_INCLUDE,
  paidBy: { select: { id: true, name: true } },
  shuttlecockRecipient: { select: { id: true, name: true } },
} as const;

type ExpenseWithRelations = Prisma.ExpenseGetPayload<{ include: typeof EXPENSE_INCLUDE }>;
type LedgerTx = Prisma.TransactionClient;

export type LedgerServiceErrorCode = "NOT_FOUND" | "INVALID_SETTLEMENT";

export class LedgerServiceError extends Error {
  readonly code: LedgerServiceErrorCode;
  readonly status: number;

  constructor(code: LedgerServiceErrorCode, message: string) {
    super(message);
    this.name = "LedgerServiceError";
    this.code = code;
    this.status = code === "NOT_FOUND" ? 404 : 400;
  }
}

export function decimalToNumber(value: Prisma.Decimal): number {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new Error(`Invalid ledger decimal: ${String(value)}`);
  }
  return n;
}

function toShareDTO(
  share: ExpenseWithRelations["shares"][number]
): LedgerExpenseShareDTO {
  return {
    id: share.id,
    expenseId: share.expenseId,
    memberId: share.memberId,
    memberName: share.member.name,
    owed: decimalToNumber(share.owed),
    paid: decimalToNumber(share.paid),
  };
}

function toExpenseDTO(expense: ExpenseWithRelations): LedgerExpenseDTO {
  const shares = expense.shares.map(toShareDTO);
  return {
    id: expense.id,
    kind: expense.kind,
    matchId: expense.matchId,
    title: expense.title,
    amount: decimalToNumber(expense.amount),
    currency: expense.currency,
    paidByMemberId: expense.paidByMemberId,
    paidByName: expense.paidBy.name,
    status: expenseStatus(shares),
    splitwiseExpenseId: expense.splitwiseExpenseId,
    createdAt: expense.createdAt.toISOString(),
    shares,
  };
}

function registrationsForShares(
  registrations: Array<{
    id: number;
    matchId: number;
    memberId: number;
    joinedAt: Date;
    playedFull: boolean;
    member: { name: string };
    guests: Array<{ id: number; label: string | null; playedFull: boolean }>;
  }>
): RegistrationDTO[] {
  return registrations.map((r) => ({
    id: r.id,
    matchId: r.matchId,
    memberId: r.memberId,
    joinedAt: r.joinedAt.toISOString(),
    playedFull: r.playedFull,
    member: { name: r.member.name } as RegistrationDTO["member"],
    guests: r.guests.map((g) => ({
      id: g.id,
      label: g.label,
      playedFull: g.playedFull,
    })),
  }));
}

function findExpenseByMatchKind(
  client: LedgerTx | typeof db,
  matchId: number,
  kind: "MATCH" | "SHUTTLECOCK"
) {
  return client.expense.findUnique({
    where: { matchId_kind: { matchId, kind } },
    include: EXPENSE_INCLUDE,
  });
}

function isUniqueConflict(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002";
}

async function createExpenseWithShares(
  client: LedgerTx,
  data: {
    kind: "MATCH" | "SHUTTLECOCK";
    matchId: number;
    title: string;
    amount: number;
    currency: string;
    paidByMemberId: number;
    shares: Array<{ memberId: number; owed: number }>;
  }
): Promise<ExpenseWithRelations> {
  const status = expenseStatus(data.shares.map((s) => ({ owed: s.owed, paid: 0 })));
  try {
    return await client.expense.create({
      data: {
        kind: data.kind,
        matchId: data.matchId,
        title: data.title,
        amount: data.amount,
        currency: data.currency,
        paidByMemberId: data.paidByMemberId,
        status,
        shares: {
          create: data.shares.map((s) => ({
            memberId: s.memberId,
            owed: s.owed,
            paid: 0,
          })),
        },
      },
      include: EXPENSE_INCLUDE,
    });
  } catch (err) {
    if (!isUniqueConflict(err)) throw err;
    const existing = await findExpenseByMatchKind(client, data.matchId, data.kind);
    if (existing) return existing;
    throw err;
  }
}

async function findOrCreateMatchExpense(
  client: LedgerTx,
  input: {
    matchId: number;
    title: string;
    currency: string;
    paidByMemberId: number;
    amount: number;
    shares: Array<{ memberId: number; owed: number }>;
  }
): Promise<ExpenseWithRelations | null> {
  const existing = await findExpenseByMatchKind(client, input.matchId, "MATCH");
  if (existing) return existing;
  if (input.amount <= 0 || input.shares.length === 0) return null;
  return createExpenseWithShares(client, {
    kind: "MATCH",
    matchId: input.matchId,
    title: input.title,
    amount: input.amount,
    currency: input.currency,
    paidByMemberId: input.paidByMemberId,
    shares: input.shares,
  });
}

async function findOrCreateShuttlecockExpense(
  client: LedgerTx,
  input: {
    matchId: number;
    title: string;
    scheduledAt: Date;
    currency: string;
    paidByMemberId: number;
    shuttlecockRecipientMemberId: number | null;
    shuttlecockFee: number;
  }
): Promise<ExpenseWithRelations | null> {
  if (
    !shouldCreateShuttlecockRemittance({
      title: input.title,
      shuttlecockFee: input.shuttlecockFee,
      paidByMemberId: input.paidByMemberId,
      shuttlecockRecipientMemberId: input.shuttlecockRecipientMemberId,
    })
  ) {
    return findExpenseByMatchKind(client, input.matchId, "SHUTTLECOCK");
  }

  const existing = await findExpenseByMatchKind(client, input.matchId, "SHUTTLECOCK");
  if (existing) return existing;

  const recipientId = input.shuttlecockRecipientMemberId;
  if (recipientId == null) return null;

  return createExpenseWithShares(client, {
    kind: "SHUTTLECOCK",
    matchId: input.matchId,
    title: formatShuttlecockRemittanceDescription(input.title, input.scheduledAt),
    amount: input.shuttlecockFee,
    currency: input.currency,
    paidByMemberId: recipientId,
    shares: [{ memberId: input.paidByMemberId, owed: input.shuttlecockFee }],
  });
}

export async function getLedgerSnapshot(): Promise<LedgerSnapshotDTO> {
  const rows = await db.expense.findMany({
    include: EXPENSE_INCLUDE,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

  const expenses = rows.map(toExpenseDTO);
  const names = new Map<number, string>();
  const remainders: Array<{ debtorId: number; creditorId: number; remainder: number }> = [];

  for (const expense of expenses) {
    names.set(expense.paidByMemberId, expense.paidByName);
    for (const share of expense.shares) {
      names.set(share.memberId, share.memberName);
      remainders.push({
        debtorId: share.memberId,
        creditorId: expense.paidByMemberId,
        remainder: fromCents(toCents(share.owed) - toCents(share.paid)),
      });
    }
  }

  const edges: LedgerEdgeDTO[] = ledgerSimplifiedEdges(remainders).map((edge) => ({
    debtorId: edge.debtorId,
    debtorName: names.get(edge.debtorId) ?? "",
    creditorId: edge.creditorId,
    creditorName: names.get(edge.creditorId) ?? "",
    amount: edge.amount,
  }));

  return {
    currency: getCurrencyCode(),
    bridgeOn: isSplitwiseConfigured(),
    edges,
    expenses,
  };
}

export async function recordMatchExpenses(
  matchId: number
): Promise<RecordMatchLedgerResponse> {
  const match = await db.match.findUnique({
    where: { id: matchId },
    include: MATCH_LEDGER_INCLUDE,
  });

  if (!match) {
    throw new LedgerServiceError("NOT_FOUND", "Match not found.");
  }

  const totalCost = match.totalCost;
  const hours = match.hours;
  const paidByMemberId = match.paidByMemberId;
  if (
    totalCost == null ||
    !(totalCost > 0) ||
    hours == null ||
    !(hours > 0) ||
    paidByMemberId == null
  ) {
    throw new LedgerServiceError(
      "INVALID_SETTLEMENT",
      "Match is missing total cost, hours, or paid-by."
    );
  }

  const calculated = calculateShares(
    registrationsForShares(match.registrations),
    totalCost,
    hours
  );
  const debtShares = calculated.filter(
    (s) => s.owedShare > 0 && s.memberId !== paidByMemberId
  );
  const matchAmount = fromCents(debtShares.reduce((sum, s) => sum + toCents(s.owedShare), 0));
  const currency = getCurrencyCode();
  const matchTitle = formatShuttlecockRemittanceDescription(match.title, match.scheduledAt);
  const split = splitSettlementFees(totalCost, hours);

  const { matchExpense, shuttlecockExpense } = await db.$transaction(async (tx) => {
    const recordedMatch = await findOrCreateMatchExpense(tx, {
      matchId,
      title: matchTitle,
      currency,
      paidByMemberId,
      amount: matchAmount,
      shares: debtShares.map((s) => ({ memberId: s.memberId, owed: s.owedShare })),
    });

    const recordedShuttlecock = await findOrCreateShuttlecockExpense(tx, {
      matchId,
      title: match.title,
      scheduledAt: match.scheduledAt,
      currency,
      paidByMemberId,
      shuttlecockRecipientMemberId: match.shuttlecockRecipientMemberId,
      shuttlecockFee: split.shuttlecockFee,
    });

    return { matchExpense: recordedMatch, shuttlecockExpense: recordedShuttlecock };
  });

  return {
    matchExpense: matchExpense ? toExpenseDTO(matchExpense) : null,
    shuttlecockExpense: shuttlecockExpense ? toExpenseDTO(shuttlecockExpense) : null,
    splitwiseSynced: false,
    splitwiseError: null,
  };
}
