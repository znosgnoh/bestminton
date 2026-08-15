import { NextRequest, NextResponse } from "next/server";
import {
  databaseErrorResponse,
  pinFromRequest,
  requireAdminPin,
  requireDatabase,
} from "@/lib/apiHelpers";
import { importOpeningBalances, LedgerServiceError } from "@/lib/ledgerService";
import { isSplitwiseConfigured } from "@/lib/splitwise";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
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

  if (!isSplitwiseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Splitwise is not configured. Add SPLITWISE_API_KEY and SPLITWISE_GROUP_ID to your environment.",
      },
      { status: 503 }
    );
  }

  try {
    const result = await importOpeningBalances();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof LedgerServiceError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return databaseErrorResponse(err, "POST /api/ledger/import");
  }
}
