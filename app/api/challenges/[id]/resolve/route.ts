import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPin } from "@/lib/adminPin";
import { databaseErrorResponse, requireDatabase } from "@/lib/apiHelpers";
import { resolveChallenge } from "@/lib/challengeService";
import { revalidateChallengePages, revalidateMemberPages } from "@/lib/revalidate";
import type { ResolveChallengeRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseConfirmedHandicap(value: unknown): number | { error: string } {
  if (value === undefined || value === null) {
    return { error: "confirmedHandicapPoints is required (0–21)." };
  }
  if (typeof value === "string" && value.trim() === "") {
    return { error: "confirmedHandicapPoints is required (0–21)." };
  }
  const parsed =
    typeof value === "string" ? parseInt(value.trim(), 10) : Math.trunc(Number(value));
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 21) {
    return { error: "confirmedHandicapPoints must be a non-negative integer up to 21." };
  }
  return parsed;
}

function parseConfirmedScore(value: unknown): string | { error: string } {
  if (typeof value !== "string") {
    return { error: "confirmedScore is required." };
  }
  const trimmed = value.trim();
  if (!trimmed) {
    return { error: "confirmedScore is required." };
  }
  if (trimmed.length > 80) {
    return { error: "confirmedScore must be at most 80 characters." };
  }
  return trimmed;
}

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

  let body: ResolveChallengeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.winnerSide !== "A" && body.winnerSide !== "B") {
    return NextResponse.json({ error: "winnerSide must be A or B." }, { status: 400 });
  }

  const handicapResult = parseConfirmedHandicap(body.confirmedHandicapPoints);
  if (typeof handicapResult === "object") {
    return NextResponse.json({ error: handicapResult.error }, { status: 400 });
  }

  const scoreResult = parseConfirmedScore(body.confirmedScore);
  if (typeof scoreResult === "object") {
    return NextResponse.json({ error: scoreResult.error }, { status: 400 });
  }

  const pinCheck = verifyAdminPin(body.pin);
  if (!pinCheck.ok) {
    const status = pinCheck.error === "missing" ? 403 : 401;
    const message = pinCheck.error === "missing" ? "PIN required." : "Invalid PIN.";
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const result = await resolveChallenge(
      challengeId,
      body.winnerSide,
      handicapResult,
      scoreResult
    );
    revalidateChallengePages(challengeId);
    revalidateMemberPages();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy kèo." }, { status: 404 });
    }
    if (message === "INVALID_STATUS") {
      return NextResponse.json(
        { error: "Kèo phải đang đấu mới chốt được." },
        { status: 409 }
      );
    }
    return databaseErrorResponse(err, "POST /api/challenges/[id]/resolve");
  }
}
