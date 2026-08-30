import { NextRequest, NextResponse } from "next/server";
import {
  databaseErrorResponse,
  pinFromRequest,
  requireAdminPin,
  requireDatabase,
} from "@/lib/apiHelpers";
import { LedgerServiceError, resetLedgerExpensePaid } from "@/lib/ledgerService";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  let body: { pin?: string } = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as { pin?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  const { id: idStr } = await params;
  const expenseId = parseInt(idStr, 10);
  if (!Number.isInteger(expenseId) || expenseId <= 0) {
    return NextResponse.json({ error: "Invalid expense ID." }, { status: 400 });
  }

  try {
    const snapshot = await resetLedgerExpensePaid(expenseId);
    return NextResponse.json(snapshot);
  } catch (err) {
    if (err instanceof LedgerServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return databaseErrorResponse(err, "POST /api/ledger/expenses/[id]/reset-paid");
  }
}
