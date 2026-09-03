import { NextRequest, NextResponse } from "next/server";
import {
  databaseErrorResponse,
  requireDatabase,
  requireMemberPin,
} from "@/lib/apiHelpers";
import { resolveChallenge } from "@/lib/challengeService";
import { deferNotification } from "@/lib/email/defer";
import { notifyChallengeResolved } from "@/lib/email/events";
import { revalidateChallengePages, revalidateMemberPages } from "@/lib/revalidate";
import type { ResolveChallengeRequest } from "@/lib/types";

export const dynamic = "force-dynamic";
/** Allow Neon cold-start + transaction retry room (capped by plan). */
export const maxDuration = 30;

function parseConfirmedHandicap(value: unknown): number | { error: string } {
  if (value === undefined || value === null) {
    return { error: "confirmedHandicapPoints is required." };
  }
  if (typeof value === "string" && value.trim() === "") {
    return { error: "confirmedHandicapPoints is required." };
  }
  const parsed =
    typeof value === "string" ? parseInt(value.trim(), 10) : Math.trunc(Number(value));
  // Upper bound of 21 covers both 15- and 21-pt matches; resolveChallenge enforces match endpoint.
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

  const pinDenied = requireMemberPin(body.pin);
  if (pinDenied) return pinDenied;

  try {
    const result = await resolveChallenge(
      challengeId,
      body.winnerSide,
      handicapResult,
      scoreResult
    );
    revalidateChallengePages(challengeId);
    revalidateMemberPages();
    deferNotification(() => notifyChallengeResolved(challengeId));
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
    if (message === "INVALID_HANDICAP") {
      return NextResponse.json(
        { error: "Chấp điểm phải từ 0 đến điểm tới thắng của kèo." },
        { status: 400 }
      );
    }
    return databaseErrorResponse(err, "POST /api/challenges/[id]/resolve");
  }
}
