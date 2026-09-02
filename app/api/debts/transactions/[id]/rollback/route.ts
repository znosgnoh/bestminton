import { NextRequest, NextResponse } from "next/server";
import {
  pinFromRequest,
  requireAdminPin,
  requireDatabase,
} from "@/lib/apiHelpers";
import { rollbackOjSettle } from "@/lib/ojBalance";
import { revalidateDebtPages } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  const { id: idStr } = await params;
  const id = parseInt(idStr, 10);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid transaction id." }, { status: 400 });
  }

  let body: { pin?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is valid when the captain PIN is provided in the header.
  }

  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  try {
    const transaction = await rollbackOjSettle(id);
    revalidateDebtPages();
    return NextResponse.json(transaction);
  } catch (err) {
    const code =
      err && typeof err === "object" && "code" in err
        ? String((err as { code: unknown }).code)
        : undefined;

    if (code === "NOT_FOUND") {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }
    if (code === "ALREADY_ROLLED_BACK") {
      return NextResponse.json({ error: "Already rolled back." }, { status: 409 });
    }

    console.error("[POST /api/debts/transactions/:id/rollback]", err);
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
