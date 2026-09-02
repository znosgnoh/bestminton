import { NextRequest, NextResponse } from "next/server";
import { requireDatabase, requireMemberPin } from "@/lib/apiHelpers";
import { db } from "@/lib/db";
import { deferNotification } from "@/lib/email/defer";
import { notifyDrinkDebtSettled } from "@/lib/email/events";
import { settleOjPool } from "@/lib/ojBalance";
import { revalidateDebtPages } from "@/lib/revalidate";
import type { SettleDebtRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  let body: SettleDebtRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const debtorId = Number(body.debtorId);
  const creditorId = Number(body.creditorId);
  if (!Number.isInteger(debtorId) || !Number.isInteger(creditorId)) {
    return NextResponse.json({ error: "debtorId and creditorId are required." }, { status: 400 });
  }
  if (debtorId === creditorId) {
    return NextResponse.json({ error: "Debtor and creditor must differ." }, { status: 400 });
  }

  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isInteger(amount) || amount <= 0) {
      return NextResponse.json({ error: "amount must be a positive integer." }, { status: 400 });
    }
  }

  const pinDenied = requireMemberPin(body.pin);
  if (pinDenied) return pinDenied;

  try {
    const [debtor, creditor] = await Promise.all([
      db.member.findUnique({ where: { id: debtorId } }),
      db.member.findUnique({ where: { id: creditorId } }),
    ]);
    if (!debtor || !creditor) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const result = await settleOjPool({
      fromMemberId: creditorId,
      toMemberId: debtorId,
      amount: body.amount,
    });

    revalidateDebtPages();
    deferNotification(() =>
      notifyDrinkDebtSettled({
        debtorId,
        creditorId,
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
      return NextResponse.json({ error: "Debtor and creditor must differ." }, { status: 400 });
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
