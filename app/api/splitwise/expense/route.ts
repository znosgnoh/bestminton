import { NextRequest, NextResponse } from "next/server";
import {
  isSplitwiseConfigured,
  splitwiseFetch,
  getGroupId,
  buildCreateExpensePayload,
  toFormUrlEncoded,
  validateExpenseShares,
  parseSplitwiseErrors,
  hasSplitwiseErrors,
  getSplitwiseExpenseId,
  type SplitwiseCreateExpenseResponse,
} from "@/lib/splitwise";
import type { CreateExpenseRequest } from "@/lib/types";
import { db } from "@/lib/db";
import { revalidateMatchPages } from "@/lib/revalidate";

export async function POST(request: NextRequest) {
  if (!isSplitwiseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Splitwise is not configured. Add SPLITWISE_API_KEY and SPLITWISE_GROUP_ID to your environment.",
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

  const shareError = validateExpenseShares(totalCost, paidById, participants);
  if (shareError) {
    return NextResponse.json({ error: shareError }, { status: 422 });
  }

  if (matchId) {
    const match = await db.match.findUnique({ where: { id: matchId }, select: { synced: true } });
    if (!match) {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }
    if (match.synced) {
      return NextResponse.json(
        { error: "This match has already been synced to Splitwise." },
        { status: 409 }
      );
    }
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

  const payload = buildCreateExpensePayload({ ...body, groupId: Number(groupId) });

  let res: Response;
  try {
    res = await splitwiseFetch("/create_expense", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: toFormUrlEncoded(payload),
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach Splitwise. Please check your connection." },
      { status: 502 }
    );
  }

  let data: SplitwiseCreateExpenseResponse;
  try {
    data = (await res.json()) as SplitwiseCreateExpenseResponse;
  } catch {
    return NextResponse.json(
      { error: "Splitwise returned an invalid response." },
      { status: 502 }
    );
  }

  const splitwiseError = parseSplitwiseErrors(data.errors);
  if (!res.ok || hasSplitwiseErrors(data)) {
    return NextResponse.json(
      { error: splitwiseError ?? `Splitwise error: ${res.statusText}` },
      { status: res.ok ? 422 : res.status }
    );
  }

  const expenseId = getSplitwiseExpenseId(data);
  if (!expenseId) {
    return NextResponse.json(
      { error: "Splitwise accepted the request but did not return an expense ID." },
      { status: 502 }
    );
  }

  if (matchId) {
    try {
      await db.match.update({ where: { id: matchId }, data: { synced: true } });
      revalidateMatchPages(matchId);
    } catch {
      console.error(`Failed to mark match ${matchId} as synced`);
    }
  }

  return NextResponse.json({ success: true, expenseId });
}
