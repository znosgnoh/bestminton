import { NextResponse } from "next/server";
import { databaseErrorResponse, requireDatabase } from "@/lib/apiHelpers";
import { getLedgerSnapshot } from "@/lib/ledgerService";

export const dynamic = "force-dynamic";

export async function GET() {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  try {
    const snapshot = await getLedgerSnapshot();
    return NextResponse.json(snapshot);
  } catch (err) {
    return databaseErrorResponse(err, "GET /api/ledger");
  }
}
