import { getCurrencyCode } from "./currency";
import type { CreateExpenseRequest, SplitwiseFlatPayload } from "./types";

export { getCurrencyCode };

export const SPLITWISE_BASE = "https://secure.splitwise.com/api/v3.0";

export type SplitwiseErrors = Record<string, string[]>;

export interface SplitwiseCreateExpenseResponse {
  /** OpenAPI v3.0 response shape */
  expenses?: Array<{ id: number }>;
  /** Legacy/alternate response key */
  expense?: { id: number };
  errors?: SplitwiseErrors;
}

export interface SplitwiseGroupResponse {
  group?: {
    id: number;
    name: string;
    members?: Array<{
      id: number;
      first_name: string;
      last_name: string | null;
      email: string;
      registration_status?: string;
      picture?: { small?: string; medium?: string; large?: string };
      balance?: Array<{ amount: string; currency_code: string }>;
    }>;
  };
  errors?: SplitwiseErrors;
}

export function isSplitwiseConfigured(): boolean {
  return Boolean(process.env.SPLITWISE_API_KEY && process.env.SPLITWISE_GROUP_ID);
}

function getApiKey(): string {
  const key = process.env.SPLITWISE_API_KEY;
  if (!key) throw new Error("SPLITWISE_API_KEY is not configured.");
  return key;
}

export function getGroupId(): string {
  const id = process.env.SPLITWISE_GROUP_ID;
  if (!id) throw new Error("SPLITWISE_GROUP_ID is not configured.");
  return id;
}

export async function splitwiseFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiKey = getApiKey();
  return fetch(`${SPLITWISE_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });
}

/** OpenAPI: 200 OK does not guarantee success — check that `errors` is empty. */
export function parseSplitwiseErrors(errors?: SplitwiseErrors): string | null {
  if (!errors) return null;
  const messages = Object.values(errors).flat().filter(Boolean);
  return messages.length > 0 ? messages.join(", ") : null;
}

export function hasSplitwiseErrors(data: { errors?: SplitwiseErrors }): boolean {
  return parseSplitwiseErrors(data.errors) !== null;
}

export function getSplitwiseExpenseId(data: SplitwiseCreateExpenseResponse): number | undefined {
  return data.expenses?.[0]?.id ?? data.expense?.id;
}

export function formatShareAmount(amount: number): string {
  return amount.toFixed(2);
}

/**
 * Build Splitwise create_expense flat payload (users__{i}__{property}).
 * @see https://dev.splitwise.com/#tag/expenses/paths/~1create_expense/post
 */
export function buildCreateExpensePayload(req: CreateExpenseRequest): SplitwiseFlatPayload {
  const total = formatShareAmount(req.totalCost);
  const payload: SplitwiseFlatPayload = {
    cost: total,
    description: req.description,
    group_id: req.groupId,
    currency_code: getCurrencyCode(),
    split_equally: false,
  };

  if (req.date) payload.date = req.date;
  if (req.details) payload.details = req.details;

  req.participants.forEach((p, i) => {
    payload[`users__${i}__user_id`] = p.userId;
    payload[`users__${i}__owed_share`] = formatShareAmount(p.owedShare);
    payload[`users__${i}__paid_share`] =
      p.userId === req.paidById ? total : "0.00";
  });

  return payload;
}

/** Paid By owes shuttlecockFee to recipient (recipient is Splitwise "payer"/creditor). */
export function buildShuttlecockRemittancePayload(opts: {
  groupId: number;
  fee: number;
  description: string;
  date: string;
  details?: string;
  paidBySplitwiseId: number;
  recipientSplitwiseId: number;
}): SplitwiseFlatPayload {
  return buildCreateExpensePayload({
    totalCost: opts.fee,
    description: opts.description,
    date: opts.date,
    details: opts.details,
    groupId: opts.groupId,
    paidById: opts.recipientSplitwiseId,
    participants: [
      { userId: opts.paidBySplitwiseId, owedShare: opts.fee },
      { userId: opts.recipientSplitwiseId, owedShare: 0 },
    ],
  });
}

export async function postSplitwiseExpense(
  payload: SplitwiseFlatPayload
): Promise<{ expenseId?: number; error?: string; status?: number }> {
  let res: Response;
  try {
    res = await splitwiseFetch("/create_expense", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toFormUrlEncoded(payload),
    });
  } catch {
    return { error: "Could not reach Splitwise. Please check your connection.", status: 502 };
  }

  let data: SplitwiseCreateExpenseResponse;
  try {
    data = (await res.json()) as SplitwiseCreateExpenseResponse;
  } catch {
    return { error: "Splitwise returned an invalid response.", status: 502 };
  }

  const splitwiseError = humanizeSplitwiseExpenseError(parseSplitwiseErrors(data.errors));
  if (!res.ok || hasSplitwiseErrors(data)) {
    return {
      error: splitwiseError ?? `Splitwise error: ${res.statusText}`,
      status: res.ok ? 422 : res.status,
    };
  }

  const expenseId = getSplitwiseExpenseId(data);
  if (!expenseId) {
    return {
      error: "Splitwise accepted the request but did not return an expense ID.",
      status: 502,
    };
  }

  return { expenseId };
}

export function toFormUrlEncoded(payload: SplitwiseFlatPayload): string {
  return Object.entries(payload)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");
}

export function validateExpenseShares(
  totalCost: number,
  paidById: number,
  participants: Array<{ userId: number; owedShare: number }>
): string | null {
  if (!participants.length) return "At least one participant is required.";

  const payer = participants.find((p) => p.userId === paidById);
  if (!payer) return "Payer must be included in participants.";

  const owedCents = participants.reduce((s, p) => s + Math.round(p.owedShare * 100), 0);
  const totalCents = Math.round(totalCost * 100);
  if (owedCents !== totalCents) {
    return `Rounding mismatch: shares sum to ${(owedCents / 100).toFixed(2)} but total is ${totalCost.toFixed(2)}.`;
  }

  for (const p of participants) {
    if (!Number.isInteger(p.userId) || p.userId <= 0) {
      return "Each participant must have a valid Splitwise user ID.";
    }
    if (p.owedShare < 0) return "Participant shares cannot be negative.";
  }

  return null;
}

export function splitwiseMemberName(
  first: string,
  last: string | null | undefined
): string {
  return [first, last].filter(Boolean).join(" ").trim() || first;
}

export interface SplitwiseGroupMemberRef {
  id: number;
  displayName: string;
}

/** Fetch group members for membership checks before create_expense. */
export async function fetchGroupMembers(
  groupId: string
): Promise<{ members: SplitwiseGroupMemberRef[]; groupName?: string } | { error: string }> {
  let res: Response;
  try {
    res = await splitwiseFetch(`/get_group/${groupId}`);
  } catch {
    return { error: "Could not reach Splitwise to verify group members." };
  }

  let data: SplitwiseGroupResponse;
  try {
    data = (await res.json()) as SplitwiseGroupResponse;
  } catch {
    return { error: "Splitwise returned an invalid group response." };
  }

  const splitwiseError = parseSplitwiseErrors(data.errors);
  if (!res.ok || hasSplitwiseErrors(data)) {
    return { error: splitwiseError ?? `Could not load Splitwise group ${groupId}.` };
  }

  const members = (data.group?.members ?? [])
    .filter((m) => m.registration_status !== "dummy")
    .map((m) => ({
      id: m.id,
      displayName: splitwiseMemberName(m.first_name, m.last_name),
    }));

  return { members, groupName: data.group?.name };
}

/**
 * Splitwise returns a cryptic "does not involve yourself" error when any
 * participant is not in the target group. Detect that up front.
 */
export function findParticipantsMissingFromGroup(
  participants: Array<{ userId: number }>,
  groupMembers: SplitwiseGroupMemberRef[]
): number[] {
  const inGroup = new Set(groupMembers.map((m) => m.id));
  return [...new Set(participants.map((p) => p.userId).filter((id) => !inGroup.has(id)))];
}

export function humanizeSplitwiseExpenseError(raw: string | null): string | null {
  if (!raw) return null;
  if (raw.includes("does not involve yourself")) {
    return (
      `${raw} ` +
      "Usually this means one or more players have a Splitwise ID that is not in the configured group — " +
      "add them to the group (or fix their Splitwise ID), then try again."
    );
  }
  return raw;
}
