import { NextRequest, NextResponse } from "next/server";
import {
  databaseErrorResponse,
  pinFromRequest,
  requireAdminPin,
  requireDatabase,
} from "@/lib/apiHelpers";
import { LedgerServiceError, recordMatchExpenses } from "@/lib/ledgerService";
import type { RecordMatchLedgerRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  let body: RecordMatchLedgerRequest;
  try {
    body = (await request.json()) as RecordMatchLedgerRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  const matchId = Number(body.matchId);
  if (!Number.isInteger(matchId) || matchId <= 0) {
    return NextResponse.json({ error: "matchId is required." }, { status: 400 });
  }

  try {
    const result = await recordMatchExpenses(matchId);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LedgerServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return databaseErrorResponse(err, "POST /api/ledger/record");
  }
}
