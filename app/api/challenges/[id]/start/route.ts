import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPin } from "@/lib/adminPin";
import { requireDatabase } from "@/lib/apiHelpers";
import { startChallenge } from "@/lib/challengeService";
import { revalidateChallengePages } from "@/lib/revalidate";
import type { StartChallengeRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  const { id: idStr } = await params;
  const challengeId = parseInt(idStr);
  if (isNaN(challengeId)) {
    return NextResponse.json({ error: "ID kèo không hợp lệ." }, { status: 400 });
  }

  let body: StartChallengeRequest = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as StartChallengeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinCheck = verifyAdminPin(body.pin);
  if (!pinCheck.ok) {
    const status = pinCheck.error === "missing" ? 403 : 401;
    const message = pinCheck.error === "missing" ? "PIN required." : "Invalid PIN.";
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const result = await startChallenge(challengeId);
    revalidateChallengePages(challengeId);
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy kèo." }, { status: 404 });
    }
    if (message === "INVALID_STATUS") {
      return NextResponse.json(
        { error: "Kèo phải đang chờ gạ mới bắt đầu được." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
