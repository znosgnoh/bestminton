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
