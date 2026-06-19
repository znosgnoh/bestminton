import { NextRequest, NextResponse } from "next/server";
import { isSplitwiseConfigured, splitwiseFetch, getGroupId } from "@/lib/splitwise";
import type { CreateExpenseRequest, SplitwiseFlatPayload } from "@/lib/types";
import { db } from "@/lib/db";

function buildSplitwisePayload(req: CreateExpenseRequest): SplitwiseFlatPayload {
  const payload: SplitwiseFlatPayload = {
    cost: req.totalCost.toFixed(2),
    description: req.description,
    group_id: req.groupId,
    currency_code: "THB",
    split_equally: false,
  };

  req.participants.forEach((p, i) => {
    payload[`users__${i}__user_id`] = p.userId;
    payload[`users__${i}__owed_share`] = p.owedShare.toFixed(2);
    payload[`users__${i}__paid_share`] =
      p.userId === req.paidById ? req.totalCost.toFixed(2) : "0.00";
  });

  return payload;
}

export async function POST(request: NextRequest) {
  if (!isSplitwiseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Splitwise is not configured. Add SPLITWISE_API_KEY and SPLITWISE_GROUP_ID to .env.local.",
      },
      { status: 503 }
    );
  }

  let body: CreateExpenseRequest;
  try {
    body = (await request.json()) as CreateExpenseRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const { totalCost, paidById, participants, matchId } = body;
  if (!totalCost || totalCost <= 0 || !paidById || !participants?.length) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  // Server-side rounding invariant check
  const sumCents = participants.reduce((s, p) => s + Math.round(p.owedShare * 100), 0);
  const totalCents = Math.round(totalCost * 100);
  if (sumCents !== totalCents) {
    return NextResponse.json(
      {
        error: `Rounding mismatch: shares sum to ${(sumCents / 100).toFixed(2)} but total is ${totalCost.toFixed(2)}.`,
      },
      { status: 422 }
    );
  }

  let groupId: string;
  try {
    groupId = getGroupId();
  } catch {
    return NextResponse.json(
      { error: "Server configuration error: SPLITWISE_GROUP_ID is not set." },
      { status: 500 }
    );
  }

  const payload = buildSplitwisePayload({ ...body, groupId: Number(groupId) });
  const formBody = Object.entries(payload)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join("&");

  let res: Response;
  try {
    res = await splitwiseFetch("/create_expense", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formBody,
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach Splitwise. Please check your connection." },
      { status: 502 }
    );
  }

  const data = (await res.json()) as {
    expense?: { id: number };
    errors?: Record<string, string[]>;
  };

  if (!res.ok) {
    const errMsg =
      data.errors && Object.values(data.errors).flat().length > 0
        ? Object.values(data.errors).flat().join(", ")
        : `Splitwise error: ${res.statusText}`;
    return NextResponse.json({ error: errMsg }, { status: res.status });
  }

  // Mark the match as synced
  if (matchId) {
    try {
      await db.match.update({ where: { id: matchId }, data: { synced: true } });
    } catch {
      // Non-fatal — expense was created, log and continue
      console.error(`Failed to mark match ${matchId} as synced`);
    }
  }

  return NextResponse.json({ success: true, expenseId: data.expense?.id });
}
