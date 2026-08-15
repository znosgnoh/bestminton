import { Prisma } from "@prisma/client";
import { calculateShares } from "./calculations";
import { getCurrencyCode } from "./currency";
import { db } from "./db";
import { expenseStatus, fromCents, ledgerSimplifiedEdges, toCents } from "./ledgerMath";
import { MATCH_FULL_INCLUDE } from "./prismaIncludes";
import { revalidateMatchPages } from "./revalidate";
import {
  buildCreateExpensePayload,
  buildShuttlecockRemittancePayload,
  fetchGroupMembers,
  findParticipantsMissingFromGroup,
  formatShareAmount,
  getGroupId,
  isSplitwiseConfigured,
  postSplitwiseExpense,
  validateExpenseShares,
} from "./splitwise";
import {
  DEFAULT_SHUTTLECOCK_RECIPIENT_NAME,
  formatShuttlecockRemittanceDescription,
  shouldCreateShuttlecockRemittance,
  splitSettlementFees,
} from "./shuttlecock";
import type {
  CalculatedShare,
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
  paidBy: { select: { id: true, name: true, splitwiseId: true } },
  shuttlecockRecipient: { select: { id: true, name: true, splitwiseId: true } },
} as const;

type SplitwiseMemberRef = { id: number; name: string; splitwiseId: number | null };

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

function recordResponse(
  matchExpense: ExpenseWithRelations | null,
  shuttlecockExpense: ExpenseWithRelations | null,
  splitwiseSynced: boolean,
  splitwiseError: string | null
): RecordMatchLedgerResponse {
  return {
    matchExpense: matchExpense ? toExpenseDTO(matchExpense) : null,
    shuttlecockExpense: shuttlecockExpense ? toExpenseDTO(shuttlecockExpense) : null,
    splitwiseSynced,
    splitwiseError,
  };
}

async function resolveShuttlecockRecipient(
  match: {
    shuttlecockRecipientMemberId: number | null;
    shuttlecockRecipient: SplitwiseMemberRef | null;
  },
  shuttlecockFee: number
): Promise<{ recipientMemberId: number | null; recipient: SplitwiseMemberRef | null }> {
  if (match.shuttlecockRecipientMemberId != null) {
    return {
      recipientMemberId: match.shuttlecockRecipientMemberId,
      recipient: match.shuttlecockRecipient,
    };
  }
  if (!(shuttlecockFee > 0)) {
    return { recipientMemberId: null, recipient: null };
  }
  const tienHoang = await db.member.findFirst({
    where: { name: { equals: DEFAULT_SHUTTLECOCK_RECIPIENT_NAME, mode: "insensitive" } },
    select: { id: true, name: true, splitwiseId: true },
  });
  if (!tienHoang) return { recipientMemberId: null, recipient: null };
  return { recipientMemberId: tienHoang.id, recipient: tienHoang };
}

async function attachSplitwiseExpenseId(
  expense: ExpenseWithRelations | null,
  splitwiseExpenseId: number
): Promise<ExpenseWithRelations | null> {
  if (!expense) return null;
  if (expense.splitwiseExpenseId === splitwiseExpenseId) return expense;
  return db.expense.update({
    where: { id: expense.id },
    data: { splitwiseExpenseId },
    include: EXPENSE_INCLUDE,
  });
}

function courtExpenseDetails(input: {
  venue: string;
  hours: number;
  split: ReturnType<typeof splitSettlementFees>;
  paidByName: string;
  recipientName: string | null;
  includeRemittanceNote: boolean;
}): string | undefined {
  const parts: string[] = [];
  if (input.venue) parts.push(`Venue: ${input.venue}`);
  parts.push(
    `Court ${formatShareAmount(input.split.courtFee)} + shuttlecock ${formatShareAmount(input.split.shuttlecockFee)} ` +
      `(${formatShareAmount(input.split.ratePerHour)}/h × ${input.hours}h)`
  );
  if (input.includeRemittanceNote && input.recipientName) {
    parts.push(`${input.paidByName} remits shuttlecock to ${input.recipientName}`);
  }
  return parts.length ? parts.join("\n") : undefined;
}

async function missingSplitwiseGroupLabels(
  missingIds: number[],
  groupId: string,
  groupName?: string
): Promise<string> {
  const localMembers = await db.member.findMany({
    where: { splitwiseId: { in: missingIds } },
    select: { name: true, splitwiseId: true },
  });
  const nameBySwId = new Map(localMembers.map((m) => [m.splitwiseId!, m.name] as const));
  const labels = missingIds.map(
    (id) => `${nameBySwId.get(id) ?? `Splitwise user ${id}`} (SW ${id})`
  );
  const groupLabel = groupName ? `"${groupName}"` : `group ${groupId}`;
  return (
    `These players are not in Splitwise ${groupLabel}: ${labels.join(", ")}. ` +
    "Add them to that group (or fix their Splitwise ID in Management), then sync again."
  );
}

async function markMatchSplitwiseSynced(input: {
  matchId: number;
  remitted: boolean;
  recipientMemberId: number | null;
}): Promise<void> {
  try {
    await db.match.update({
      where: { id: input.matchId },
      data: {
        synced: true,
        ...(input.remitted
          ? {
              shuttlecockRemitted: true,
              ...(input.recipientMemberId != null
                ? { shuttlecockRecipientMemberId: input.recipientMemberId }
                : {}),
            }
          : {}),
      },
    });
    revalidateMatchPages(input.matchId);
  } catch {
    console.error(`Failed to mark match ${input.matchId} as synced`);
  }
}

async function syncLedgerToSplitwise(input: {
  matchId: number;
  title: string;
  venue: string;
  scheduledAt: Date;
  synced: boolean;
  shuttlecockRemitted: boolean;
  totalCost: number;
  hours: number;
  paidByMemberId: number;
  paidBy: SplitwiseMemberRef;
  recipientMemberId: number | null;
  recipient: SplitwiseMemberRef | null;
  calculated: CalculatedShare[];
  split: ReturnType<typeof splitSettlementFees>;
  memberRefs: Map<number, SplitwiseMemberRef>;
  matchExpense: ExpenseWithRelations | null;
  shuttlecockExpense: ExpenseWithRelations | null;
}): Promise<RecordMatchLedgerResponse> {
  let { matchExpense, shuttlecockExpense } = input;

  if (input.synced) {
    return recordResponse(matchExpense, shuttlecockExpense, true, null);
  }

  const fail = (splitwiseError: string) =>
    recordResponse(matchExpense, shuttlecockExpense, false, splitwiseError);

  const missingLocal = input.calculated.filter((s) => {
    const swId = input.memberRefs.get(s.memberId)?.splitwiseId;
    return swId == null;
  });
  if (missingLocal.length > 0) {
    const names = missingLocal.map((s) => s.name).join(", ");
    return fail(
      `Missing Splitwise ID for: ${names}. Update them in Management, then sync again.`
    );
  }
  if (input.paidBy.splitwiseId == null) {
    return fail(
      `Missing Splitwise ID for: ${input.paidBy.name}. Update them in Management, then sync again.`
    );
  }

  const participants = input.calculated.map((s) => ({
    userId: input.memberRefs.get(s.memberId)!.splitwiseId!,
    owedShare: s.owedShare,
  }));

  const shareError = validateExpenseShares(
    input.totalCost,
    input.paidBy.splitwiseId,
    participants
  );
  if (shareError) return fail(shareError);

  let groupId: string;
  try {
    groupId = getGroupId();
  } catch {
    return fail("Server configuration error: SPLITWISE_GROUP_ID is not set.");
  }

  const groupLookup = await fetchGroupMembers(groupId);
  if ("error" in groupLookup) return fail(groupLookup.error);

  const missingIds = findParticipantsMissingFromGroup(participants, groupLookup.members);
  if (missingIds.length > 0) {
    return fail(await missingSplitwiseGroupLabels(missingIds, groupId, groupLookup.groupName));
  }

  const wantsRemittance = shouldCreateShuttlecockRemittance({
    title: input.title,
    shuttlecockFee: input.split.shuttlecockFee,
    paidByMemberId: input.paidByMemberId,
    shuttlecockRecipientMemberId: input.recipientMemberId,
  });
  const remittanceAlreadyPosted =
    input.shuttlecockRemitted || Boolean(shuttlecockExpense?.splitwiseExpenseId);
  const needsRemittancePost = wantsRemittance && !remittanceAlreadyPosted;

  if (needsRemittancePost) {
    if (!input.paidBy.splitwiseId || !input.recipient?.splitwiseId) {
      return fail(
        "Shuttlecock remittance requires Splitwise IDs for both Paid By and Shuttlecock recipient. " +
          "Update them in Management, then sync again."
      );
    }
    const remitMissing = findParticipantsMissingFromGroup(
      [
        { userId: input.paidBy.splitwiseId },
        { userId: input.recipient.splitwiseId },
      ],
      groupLookup.members
    );
    if (remitMissing.length > 0) {
      return fail(
        "Paid By or Shuttlecock recipient is not in the Splitwise group. " +
          "Add them to the group, then sync again."
      );
    }
  }

  const needsCourtPost =
    !matchExpense?.splitwiseExpenseId && participants.length > 0 && input.totalCost > 0;

  if (needsCourtPost) {
    const mainResult = await postSplitwiseExpense(
      buildCreateExpensePayload({
        totalCost: input.totalCost,
        description: input.title,
        date: input.scheduledAt.toISOString(),
        details: courtExpenseDetails({
          venue: input.venue,
          hours: input.hours,
          split: input.split,
          paidByName: input.paidBy.name,
          recipientName: input.recipient?.name ?? null,
          includeRemittanceNote: wantsRemittance,
        }),
        groupId: Number(groupId),
        paidById: input.paidBy.splitwiseId,
        participants,
      })
    );
    if (mainResult.error || !mainResult.expenseId) {
      return fail(mainResult.error ?? "Failed to create Splitwise expense.");
    }
    matchExpense = await attachSplitwiseExpenseId(matchExpense, mainResult.expenseId);
  }

  let remittancePosted = remittanceAlreadyPosted;
  if (needsRemittancePost && input.paidBy.splitwiseId && input.recipient?.splitwiseId) {
    const fee = input.split.shuttlecockFee;
    const remitResult = await postSplitwiseExpense(
      buildShuttlecockRemittancePayload({
        groupId: Number(groupId),
        fee,
        description: formatShuttlecockRemittanceDescription(input.title, input.scheduledAt),
        date: input.scheduledAt.toISOString(),
        details:
          `${input.paidBy.name} remits ${formatShareAmount(fee)} shuttlecock to ${input.recipient.name}` +
          (input.venue ? `\nVenue: ${input.venue}` : ""),
        paidBySplitwiseId: input.paidBy.splitwiseId,
        recipientSplitwiseId: input.recipient.splitwiseId,
      })
    );
    if (remitResult.error || !remitResult.expenseId) {
      const courtId = matchExpense?.splitwiseExpenseId;
      const prefix = courtId
        ? `Court expense was created (ID ${courtId}), but shuttlecock remittance failed: `
        : "Shuttlecock remittance failed: ";
      return fail(
        prefix +
          (remitResult.error ?? "unknown error") +
          ". Fix the issue and retry — match was not marked synced."
      );
    }
    shuttlecockExpense = await attachSplitwiseExpenseId(
      shuttlecockExpense,
      remitResult.expenseId
    );
    remittancePosted = true;
  }

  await markMatchSplitwiseSynced({
    matchId: input.matchId,
    remitted: wantsRemittance && remittancePosted,
    recipientMemberId: input.recipientMemberId,
  });

  return recordResponse(matchExpense, shuttlecockExpense, true, null);
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

  const paidBy: SplitwiseMemberRef | null =
    match.paidBy ??
    match.registrations.find((r) => r.memberId === paidByMemberId)?.member ??
    null;
  if (!paidBy) {
    throw new LedgerServiceError("INVALID_SETTLEMENT", "Match is missing total cost, hours, or paid-by.");
  }

  const { recipientMemberId, recipient } = await resolveShuttlecockRecipient(match, split.shuttlecockFee);

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
      shuttlecockRecipientMemberId: recipientMemberId,
      shuttlecockFee: split.shuttlecockFee,
    });

    return { matchExpense: recordedMatch, shuttlecockExpense: recordedShuttlecock };
  });

  if (!isSplitwiseConfigured()) {
    return recordResponse(matchExpense, shuttlecockExpense, false, null);
  }

  const memberRefs = new Map<number, SplitwiseMemberRef>();
  for (const r of match.registrations) {
    memberRefs.set(r.memberId, {
      id: r.member.id,
      name: r.member.name,
      splitwiseId: r.member.splitwiseId,
    });
  }
  memberRefs.set(paidBy.id, paidBy);
  if (recipient) memberRefs.set(recipient.id, recipient);

  return syncLedgerToSplitwise({
    matchId,
    title: match.title,
    venue: match.venue,
    scheduledAt: match.scheduledAt,
    synced: match.synced,
    shuttlecockRemitted: match.shuttlecockRemitted,
    totalCost,
    hours,
    paidByMemberId,
    paidBy,
    recipientMemberId,
    recipient,
    calculated,
    split,
    memberRefs,
    matchExpense,
    shuttlecockExpense,
  });
}
