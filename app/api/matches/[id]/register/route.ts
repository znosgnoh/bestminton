import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidateMatchPages } from "@/lib/revalidate";
import { requirePastMatchAdminPin } from "@/lib/apiHelpers";
import { Prisma } from "@prisma/client";

const REG_INCLUDE = { member: true, guests: true };

async function getMatchOr404(matchId: number) {
  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) {
    return { error: NextResponse.json({ error: "Match not found." }, { status: 404 }) };
  }
  return { match };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const matchId = parseInt(idStr);
  if (isNaN(matchId)) {
    return NextResponse.json({ error: "Invalid match ID." }, { status: 400 });
  }

  let body: { memberId?: number; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = Number(body.memberId);
  if (!memberId || isNaN(memberId)) {
    return NextResponse.json({ error: "memberId is required." }, { status: 400 });
  }

  const matchResult = await getMatchOr404(matchId);
  if ("error" in matchResult) return matchResult.error;
  const { match } = matchResult;

  const pinDenied = requirePastMatchAdminPin(request, match.scheduledAt, body);
  if (pinDenied) return pinDenied;

  try {
    const registration = await db.matchRegistration.upsert({
      where: { matchId_memberId: { matchId, memberId } },
      create: { matchId, memberId },
      update: {},
      include: REG_INCLUDE,
    });
    revalidateMatchPages(matchId);
    return NextResponse.json(JSON.parse(JSON.stringify(registration)), { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    throw err;
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const matchId = parseInt(idStr);
  if (isNaN(matchId)) {
    return NextResponse.json({ error: "Invalid match ID." }, { status: 400 });
  }

  let body: { memberId?: number; playedFull?: boolean; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = Number(body.memberId);
  if (!memberId || isNaN(memberId)) {
    return NextResponse.json({ error: "memberId is required." }, { status: 400 });
  }
  if (typeof body.playedFull !== "boolean") {
    return NextResponse.json({ error: "playedFull (boolean) is required." }, { status: 400 });
  }

  const matchResult = await getMatchOr404(matchId);
  if ("error" in matchResult) return matchResult.error;
  const { match } = matchResult;

  const pinDenied = requirePastMatchAdminPin(request, match.scheduledAt, body);
  if (pinDenied) return pinDenied;

  try {
    const updated = await db.matchRegistration.update({
      where: { matchId_memberId: { matchId, memberId } },
      data: { playedFull: body.playedFull },
      include: REG_INCLUDE,
    });
    revalidateMatchPages(matchId);
    return NextResponse.json(JSON.parse(JSON.stringify(updated)));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const matchId = parseInt(idStr);
  if (isNaN(matchId)) {
    return NextResponse.json({ error: "Invalid match ID." }, { status: 400 });
  }

  let body: { memberId?: number; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = Number(body.memberId);
  if (!memberId || isNaN(memberId)) {
    return NextResponse.json({ error: "memberId is required." }, { status: 400 });
  }

  const matchResult = await getMatchOr404(matchId);
  if ("error" in matchResult) return matchResult.error;
  const { match } = matchResult;

  const pinDenied = requirePastMatchAdminPin(request, match.scheduledAt, body);
  if (pinDenied) return pinDenied;

  try {
    await db.matchRegistration.delete({
      where: { matchId_memberId: { matchId, memberId } },
    });
    revalidateMatchPages(matchId);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }
    throw err;
  }
}
