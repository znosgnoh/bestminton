import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPin } from "@/lib/adminPin";
import { requireDatabase } from "@/lib/apiHelpers";
import { db } from "@/lib/db";
import { settleDebtBetween } from "@/lib/drinkDebt";
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

  const pinCheck = verifyAdminPin(body.pin);
  if (!pinCheck.ok) {
    const status = pinCheck.error === "missing" ? 403 : 401;
    const message = pinCheck.error === "missing" ? "PIN required." : "Invalid PIN.";
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const [debtor, creditor] = await Promise.all([
      db.member.findUnique({ where: { id: debtorId } }),
      db.member.findUnique({ where: { id: creditorId } }),
    ]);
    if (!debtor || !creditor) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const result = await settleDebtBetween(debtorId, creditorId, body.amount);
    if (result.settled === 0) {
      return NextResponse.json(
        {
          error: "No debt found to settle.",
          reason: result.reason ?? "unknown",
          debtorId,
          creditorId,
          requestedAmount: body.amount ?? null,
        },
        { status: 404 }
      );
    }

    revalidateDebtPages();
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
