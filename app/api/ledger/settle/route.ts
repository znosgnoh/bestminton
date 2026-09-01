import { NextRequest, NextResponse } from "next/server";
import {
  databaseErrorResponse,
  memberPinFromRequest,
  requireMemberPin,
  requireDatabase,
} from "@/lib/apiHelpers";
import { LedgerServiceError, markLedgerPaid } from "@/lib/ledgerService";
import { getCurrencyCode } from "@/lib/currency";
import { deferNotification } from "@/lib/email/defer";
import { notifyLedgerMarkPaid } from "@/lib/email/events";
import { toCents } from "@/lib/ledgerMath";
import type { MarkLedgerPaidRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

function isPositiveMoney(value: unknown): value is number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return false;
  return Math.abs(n * 100 - Math.round(n * 100)) < 1e-6;
}

export async function POST(request: NextRequest) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  let body: MarkLedgerPaidRequest;
  try {
    body = (await request.json()) as MarkLedgerPaidRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireMemberPin(memberPinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  const debtorId = Number(body.debtorId);
  const creditorId = Number(body.creditorId);
  if (
    !Number.isInteger(debtorId) ||
    !Number.isInteger(creditorId) ||
    debtorId <= 0 ||
    creditorId <= 0
  ) {
    return NextResponse.json(
      { error: "debtorId and creditorId are required." },
      { status: 400 }
    );
  }
  if (debtorId === creditorId) {
    return NextResponse.json(
      { error: "Debtor and creditor must differ." },
      { status: 400 }
    );
  }

  if (!isPositiveMoney(body.amount) || toCents(Number(body.amount)) < 1) {
    return NextResponse.json(
      { error: "amount must be a positive number with at most 2 decimals." },
      { status: 400 }
    );
  }

  try {
    const result = await markLedgerPaid(debtorId, creditorId, Number(body.amount));
    deferNotification(() =>
      notifyLedgerMarkPaid({
        debtorId,
        creditorId,
        appliedCents: result.appliedCents,
        appliedShareIds: result.appliedShareIds,
        currency: getCurrencyCode(),
      })
    );
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LedgerServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return databaseErrorResponse(err, "POST /api/ledger/settle");
  }
}
