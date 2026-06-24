import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPin } from "@/lib/adminPin";
import { databaseErrorResponse, requireDatabase } from "@/lib/apiHelpers";
import { db } from "@/lib/db";
import { CHALLENGE_FULL_INCLUDE } from "@/lib/challengeIncludes";
import { serializeChallenge } from "@/lib/challengeSerialize";
import {
  adminDeleteChallenge,
  adminEditChallengeWinner,
} from "@/lib/challengeService";
import { revalidateChallengePages, revalidateMemberPages } from "@/lib/revalidate";
import type { AdminDeleteChallengeRequest, AdminEditChallengeRequest, UpdateChallengeRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid challenge ID." }, { status: 400 });
  }

  try {
    const challenge = await db.challenge.findUnique({
      where: { id },
      include: CHALLENGE_FULL_INCLUDE,
    });

    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    }

    return NextResponse.json(serializeChallenge(challenge));
  } catch (err) {
    return databaseErrorResponse(err, "GET /api/challenges/[id]");
  }
}

export async function PATCH(
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

  let body: UpdateChallengeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (typeof body.isDrinkChallenge !== "boolean") {
    return NextResponse.json({ error: "isDrinkChallenge must be a boolean." }, { status: 400 });
  }

  try {
    const existing = await db.challenge.findUnique({
      where: { id: challengeId },
      select: { status: true },
    });

    if (!existing) {
      return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    }

    if (existing.status !== "PENDING") {
      return NextResponse.json(
        { error: "Drink challenge setting can only be changed before the match starts." },
        { status: 409 }
      );
    }

    const updated = await db.challenge.update({
      where: { id: challengeId },
      data: { isDrinkChallenge: body.isDrinkChallenge },
      include: CHALLENGE_FULL_INCLUDE,
    });

    revalidateChallengePages(challengeId);
    return NextResponse.json(serializeChallenge(updated));
  } catch (err) {
    return databaseErrorResponse(err, "PATCH /api/challenges/[id]");
  }
}

export async function PUT(
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

  let body: AdminEditChallengeRequest;
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
    const updated = await adminEditChallengeWinner(challengeId, body.winnerSide);
    revalidateChallengePages(challengeId);
    revalidateMemberPages();
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    }
    if (message === "INVALID_STATUS") {
      return NextResponse.json(
        { error: "Only completed challenges can have their winner edited." },
        { status: 409 }
      );
    }
    if (message === "SAME_WINNER") {
      return NextResponse.json({ error: "Winner is already set to that side." }, { status: 409 });
    }
    if (message === "NO_SNAPSHOT") {
      return NextResponse.json(
        { error: "Challenge has no resolution snapshot — edit member Elo manually." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}

export async function DELETE(
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

  let body: AdminDeleteChallengeRequest = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as AdminDeleteChallengeRequest;
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
    const challenge = await db.challenge.findUnique({
      where: { id: challengeId },
      select: { resolutionSnapshot: true },
    });
    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    }

    const snapshot = challenge.resolutionSnapshot as { debts?: unknown[] } | null;
    const debtCount = snapshot?.debts?.length ?? 0;
    if (debtCount > 0 && !body.confirmDebts) {
      return NextResponse.json(
        {
          error: `This challenge created ${debtCount} drink debt record(s). Confirm deletion to proceed — debts in the ledger will NOT be reversed.`,
          debtCount,
          requiresConfirm: true,
        },
        { status: 409 }
      );
    }

    const result = await adminDeleteChallenge(challengeId);
    revalidateChallengePages(challengeId);
    revalidateMemberPages();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    }
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
