import { NextRequest, NextResponse } from "next/server";
import {
  memberPinFromRequest,
  requireDatabase,
  requireMemberPin,
} from "@/lib/apiHelpers";
import { db } from "@/lib/db";
import { deferNotification } from "@/lib/email/defer";
import { notifyDrinkDebtSettled } from "@/lib/email/events";
import { settleOjPool } from "@/lib/ojBalance";
import { revalidateDebtPages } from "@/lib/revalidate";
import type { SettleOjRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  let body: SettleOjRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const fromMemberId = Number(body.fromMemberId ?? body.creditorId);
  const toMemberId = Number(body.toMemberId ?? body.debtorId);
  if (!Number.isInteger(fromMemberId) || !Number.isInteger(toMemberId)) {
    return NextResponse.json(
      { error: "fromMemberId and toMemberId are required." },
      { status: 400 }
    );
  }
  if (fromMemberId === toMemberId) {
    return NextResponse.json({ error: "Pool members must differ." }, { status: 400 });
  }

  let amount: number | undefined;
  if (body.amount !== undefined) {
    amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be a positive integer." }, { status: 400 });
    }
  }

  const pinDenied = requireMemberPin(memberPinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  try {
    const [fromMember, toMember] = await Promise.all([
      db.member.findUnique({ where: { id: fromMemberId }, select: { id: true } }),
      db.member.findUnique({ where: { id: toMemberId }, select: { id: true } }),
    ]);
    if (!fromMember || !toMember) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const result = await settleOjPool({
      fromMemberId,
      toMemberId,
      amount,
    });

    revalidateDebtPages();
    deferNotification(() =>
      notifyDrinkDebtSettled({
        debtorId: toMemberId,
        creditorId: fromMemberId,
        settledAmount: result.settled,
      })
    );
    return NextResponse.json(result);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : undefined;

    if (code === "SAME_MEMBER") {
      return NextResponse.json({ error: "Pool members must differ." }, { status: 400 });
    }
    if (code === "NO_BALANCE") {
      return NextResponse.json(
        { error: "No settleable orange juice balance between these members." },
        { status: 400 }
      );
    }
    if (code === "INSUFFICIENT") {
      const max =
        err && typeof err === "object" && "max" in err
          ? Number((err as { max: unknown }).max)
          : undefined;
      return NextResponse.json(
        {
          error: "amount exceeds maximum settleable balance.",
          ...(Number.isFinite(max) ? { max } : {}),
        },
        { status: 409 }
      );
    }

    console.error("[POST /api/debts/settle]", err);
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
