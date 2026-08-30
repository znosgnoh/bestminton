import { NextRequest, NextResponse } from "next/server";
import { isMemberPinRequired, verifyMemberPin } from "@/lib/memberPin";
import type { VerifyPinRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({ pinRequired: isMemberPinRequired() });
}

export async function POST(request: NextRequest) {
  let body: VerifyPinRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!isMemberPinRequired()) {
    return NextResponse.json({ ok: true });
  }

  const pinCheck = verifyMemberPin(body.pin);
  if (!pinCheck.ok) {
    return NextResponse.json({ error: "Invalid PIN." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
