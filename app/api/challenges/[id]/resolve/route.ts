import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPin } from "@/lib/adminPin";
import { requireDatabase } from "@/lib/apiHelpers";
import { resolveChallenge } from "@/lib/challengeService";
import { revalidateChallengePages, revalidateMemberPages } from "@/lib/revalidate";
import type { ResolveChallengeRequest } from "@/lib/types";

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
    return NextResponse.json({ error: "Invalid challenge ID." }, { status: 400 });
  }

  let body: ResolveChallengeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.winnerSide !== "A" && body.winnerSide !== "B") {
    return NextResponse.json({ error: "winnerSide must be A or B." }, { status: 400 });
  }

  const pinCheck = verifyAdminPin(body.pin);
  if (!pinCheck.ok) {
    const status = pinCheck.error === "missing" ? 403 : 401;
    const message = pinCheck.error === "missing" ? "PIN required." : "Invalid PIN.";
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const result = await resolveChallenge(challengeId, body.winnerSide);
    revalidateChallengePages(challengeId);
    revalidateMemberPages();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    }
    if (message === "INVALID_STATUS") {
      return NextResponse.json(
        { error: "Challenge must be active to resolve." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
