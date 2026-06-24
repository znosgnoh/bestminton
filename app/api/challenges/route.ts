import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireDatabase } from "@/lib/apiHelpers";
import { CHALLENGE_LIST_INCLUDE } from "@/lib/challengeIncludes";
import { serializeChallenge, serializeChallengeList } from "@/lib/challengeSerialize";
import { sideAverageElo, suggestedHandicap } from "@/lib/elo";
import { revalidateChallengePages } from "@/lib/revalidate";
import type { CreateChallengeRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

function parseHandicapPoints(
  value: unknown,
  fallback: number
): number | { error: string } {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 21) {
    return { error: "handicapPoints must be a non-negative integer up to 21." };
  }
  return parsed;
}

export async function GET(request: NextRequest) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  const status = request.nextUrl.searchParams.get("status");
  const where =
    status === "PENDING" || status === "ACTIVE" || status === "COMPLETED"
      ? { status: status as "PENDING" | "ACTIVE" | "COMPLETED" }
      : undefined;

  try {
    const challenges = await db.challenge.findMany({
      where,
      include: CHALLENGE_LIST_INCLUDE,
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(challenges.map(serializeChallengeList));
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  let body: CreateChallengeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const format = body.format;
  if (format !== "SINGLES" && format !== "DOUBLES") {
    return NextResponse.json({ error: "format must be SINGLES or DOUBLES." }, { status: 400 });
  }

  const playerAId = Number(body.playerAId);
  const playerBId = Number(body.playerBId);
  const playerA2Id = body.playerA2Id !== undefined ? Number(body.playerA2Id) : null;
  const playerB2Id = body.playerB2Id !== undefined ? Number(body.playerB2Id) : null;

  if (!Number.isInteger(playerAId) || !Number.isInteger(playerBId)) {
    return NextResponse.json({ error: "Invalid player IDs." }, { status: 400 });
  }

  if (format === "SINGLES") {
    if (playerAId === playerBId) {
      return NextResponse.json({ error: "Players must be distinct." }, { status: 400 });
    }
    if (playerA2Id !== null || playerB2Id !== null) {
      return NextResponse.json({ error: "Kèo đơn không được có đồng đội." }, { status: 400 });
    }
  } else {
    if (
      playerA2Id === null ||
      playerB2Id === null ||
      !Number.isInteger(playerA2Id) ||
      !Number.isInteger(playerB2Id)
    ) {
      return NextResponse.json({ error: "Doubles requires four distinct players." }, { status: 400 });
    }
    const ids = [playerAId, playerA2Id, playerBId, playerB2Id];
    if (new Set(ids).size !== 4) {
      return NextResponse.json({ error: "All four players must be distinct." }, { status: 400 });
    }
  }

  const memberIds =
    format === "SINGLES"
      ? [playerAId, playerBId]
      : [playerAId, playerA2Id!, playerBId, playerB2Id!];

  try {
    const members = await db.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, eloRating: true },
    });

    if (members.length !== memberIds.length) {
      return NextResponse.json({ error: "One or more players not found." }, { status: 404 });
    }

    const ratingMap = new Map(members.map((m) => [m.id, m.eloRating]));
    const sideAAvg = sideAverageElo(
      format === "SINGLES"
        ? [ratingMap.get(playerAId)!]
        : [ratingMap.get(playerAId)!, ratingMap.get(playerA2Id!)!]
    );
    const sideBAvg = sideAverageElo(
      format === "SINGLES"
        ? [ratingMap.get(playerBId)!]
        : [ratingMap.get(playerBId)!, ratingMap.get(playerB2Id!)!]
    );
    const suggested = suggestedHandicap(sideAAvg, sideBAvg);
    const handicapResult = parseHandicapPoints(body.handicapPoints, suggested);
    if (typeof handicapResult === "object") {
      return NextResponse.json({ error: handicapResult.error }, { status: 400 });
    }
    const handicapPoints = handicapResult;
    const isDrinkChallenge = body.isDrinkChallenge === true;

    const challenge = await db.challenge.create({
      data: {
        format,
        status: "PENDING",
        playerAId,
        playerA2Id: format === "DOUBLES" ? playerA2Id : null,
        playerBId,
        playerB2Id: format === "DOUBLES" ? playerB2Id : null,
        handicapPoints,
        isDrinkChallenge,
      },
      include: CHALLENGE_LIST_INCLUDE,
    });

    revalidateChallengePages();
    return NextResponse.json(serializeChallenge(challenge), { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      return NextResponse.json({ error: "Gạ kèo thất bại." }, { status: 400 });
    }
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
