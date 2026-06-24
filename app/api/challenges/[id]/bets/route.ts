import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDatabase } from "@/lib/apiHelpers";
import { DEFAULT_BET_AMOUNT } from "@/lib/constants";
import { CHALLENGE_FULL_INCLUDE } from "@/lib/challengeIncludes";
import { serializeChallenge } from "@/lib/challengeSerialize";
import { revalidateChallengePages } from "@/lib/revalidate";
import type { ChallengeSide, UpsertBetRequest } from "@/lib/types";

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

  let body: UpsertBetRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const bettorId = Number(body.bettorId);
  const counterpartyId = Number(body.counterpartyId);
  const side = body.side;
  if (
    !Number.isInteger(bettorId) ||
    !Number.isInteger(counterpartyId) ||
    (side !== "A" && side !== "B")
  ) {
    return NextResponse.json({ error: "Invalid bettor, counterparty, or side." }, { status: 400 });
  }

  if (bettorId === counterpartyId) {
    return NextResponse.json(
      { error: "Bettor and counterparty must be different people." },
      { status: 400 }
    );
  }

  try {
    const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    }
    if (challenge.status !== "PENDING") {
      return NextResponse.json(
        { error: "Bets can only be placed while challenge is pending." },
        { status: 409 }
      );
    }

    const [bettor, counterparty] = await Promise.all([
      db.member.findUnique({ where: { id: bettorId } }),
      db.member.findUnique({ where: { id: counterpartyId } }),
    ]);
    if (!bettor) {
      return NextResponse.json({ error: "Bettor not found." }, { status: 404 });
    }
    if (!counterparty) {
      return NextResponse.json({ error: "Counterparty not found." }, { status: 404 });
    }

    await db.bet.upsert({
      where: { challengeId_bettorId: { challengeId, bettorId } },
      create: {
        challengeId,
        bettorId,
        counterpartyId,
        side: side as ChallengeSide,
        amount: DEFAULT_BET_AMOUNT,
      },
      update: { side: side as ChallengeSide, counterpartyId },
    });

    const updated = await db.challenge.findUnique({
      where: { id: challengeId },
      include: CHALLENGE_FULL_INCLUDE,
    });

    revalidateChallengePages(challengeId);
    return NextResponse.json(serializeChallenge(updated!));
  } catch {
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

  let bettorId: number;
  try {
    const body = await request.json();
    bettorId = Number(body.bettorId);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (!Number.isInteger(bettorId)) {
    return NextResponse.json({ error: "Invalid bettor ID." }, { status: 400 });
  }

  return removeBet(challengeId, bettorId);
}

async function removeBet(challengeId: number, bettorId: number) {
  try {
    const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) {
      return NextResponse.json({ error: "Challenge not found." }, { status: 404 });
    }
    if (challenge.status !== "PENDING") {
      return NextResponse.json(
        { error: "Bets can only be removed while challenge is pending." },
        { status: 409 }
      );
    }

    const existing = await db.bet.findUnique({
      where: { challengeId_bettorId: { challengeId, bettorId } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Bet not found." }, { status: 404 });
    }

    await db.bet.delete({
      where: { challengeId_bettorId: { challengeId, bettorId } },
    });

    const updated = await db.challenge.findUnique({
      where: { id: challengeId },
      include: CHALLENGE_FULL_INCLUDE,
    });

    revalidateChallengePages(challengeId);
    return NextResponse.json(serializeChallenge(updated!));
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
