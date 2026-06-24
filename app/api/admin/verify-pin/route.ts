import { NextRequest, NextResponse } from "next/server";
import { isPinRequired, verifyAdminPin } from "@/lib/adminPin";
import type { VerifyPinRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ pinRequired: isPinRequired() });
}

export async function POST(request: NextRequest) {
  let body: VerifyPinRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isPinRequired()) {
    return NextResponse.json({ ok: true });
  }

  const pinCheck = verifyAdminPin(body.pin);
  if (!pinCheck.ok) {
    return NextResponse.json({ error: "Invalid PIN." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
