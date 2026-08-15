import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse, pinFromRequest, requireAdminPin } from "@/lib/apiHelpers";
import { LedgerServiceError, recordMatchExpenses } from "@/lib/ledgerService";
import type { RecordMatchLedgerResponse } from "@/lib/types";

function expenseJson(result: RecordMatchLedgerResponse, extra?: { error?: string }) {
  const expenseId = result.matchExpense?.splitwiseExpenseId ?? null;
  const shuttlecockExpenseId = result.shuttlecockExpense?.splitwiseExpenseId ?? null;
  return {
    ...extra,
    success: !result.splitwiseError,
    expenseId,
    shuttlecockExpenseId,
    shuttlecockRemitted: Boolean(shuttlecockExpenseId),
    splitwiseSynced: result.splitwiseSynced,
    splitwiseError: result.splitwiseError,
    matchExpense: result.matchExpense,
    shuttlecockExpense: result.shuttlecockExpense,
  };
}

export async function POST(request: NextRequest) {
  let body: { matchId?: number; pin?: string };
  try {
    body = (await request.json()) as { matchId?: number; pin?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  const matchId = body.matchId;
  if (typeof matchId !== "number" || !Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
  }

  try {
    const result = await recordMatchExpenses(matchId);
    if (result.splitwiseError) {
      return NextResponse.json(expenseJson(result, { error: result.splitwiseError }), {
        status: 502,
      });
    }
    return NextResponse.json(expenseJson(result));
  } catch (err) {
    if (err instanceof LedgerServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return databaseErrorResponse(err, "splitwise/expense");
  }
}
