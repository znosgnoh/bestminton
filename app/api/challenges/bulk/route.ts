import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import {
  databaseErrorResponse,
  pinFromRequest,
  requireAdminPin,
  requireDatabase,
} from "@/lib/apiHelpers";
import { buildBulkSinglesRows, parseBulkChallengeInput } from "@/lib/bulkChallenges";
import { revalidateChallengePages } from "@/lib/revalidate";
import type { CreateBulkChallengesRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  let body: CreateBulkChallengesRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  const parsed = parseBulkChallengeInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const { memberIds, perPair, isDrinkChallenge, pointsToWin } = parsed.value;

  try {
    const members = await db.member.findMany({
      where: { id: { in: memberIds } },
      select: { id: true, eloRating: true },
    });

    if (members.length !== memberIds.length) {
      return NextResponse.json({ error: "One or more players not found." }, { status: 404 });
    }

    const rows = buildBulkSinglesRows(members, perPair, { isDrinkChallenge, pointsToWin });
    if (rows.length === 0) {
      return NextResponse.json({ error: "No kèo to create." }, { status: 400 });
    }

    const result = await db.challenge.createMany({ data: rows });
    revalidateChallengePages();
    return NextResponse.json({ created: result.count }, { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code !== "P2022") {
      return NextResponse.json({ error: "Tạo nhiều kèo thất bại." }, { status: 400 });
    }
    return databaseErrorResponse(err, "POST /api/challenges/bulk");
  }
}
