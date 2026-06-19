import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";

const REG_INCLUDE = { member: true, guests: true };

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const matchId = parseInt(idStr);
  if (isNaN(matchId)) {
    return NextResponse.json({ error: "Invalid match ID." }, { status: 400 });
  }

  let body: { memberId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = Number(body.memberId);
  if (!memberId || isNaN(memberId)) {
    return NextResponse.json({ error: "memberId is required." }, { status: 400 });
  }

  const match = await db.match.findUnique({ where: { id: matchId } });
  if (!match) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }
  if (new Date(match.scheduledAt) < new Date()) {
    return NextResponse.json(
      { error: "Registration is closed for past matches." },
      { status: 400 }
    );
  }

  try {
    const registration = await db.matchRegistration.upsert({
      where: { matchId_memberId: { matchId, memberId } },
      create: { matchId, memberId },
      update: {},
      include: REG_INCLUDE,
    });
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

  let body: { memberId?: number; playedFull?: boolean };
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

  try {
    const updated = await db.matchRegistration.update({
      where: { matchId_memberId: { matchId, memberId } },
      data: { playedFull: body.playedFull },
      include: REG_INCLUDE,
    });
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

  let body: { memberId?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = Number(body.memberId);
  if (!memberId || isNaN(memberId)) {
    return NextResponse.json({ error: "memberId is required." }, { status: 400 });
  }

  try {
    await db.matchRegistration.delete({
      where: { matchId_memberId: { matchId, memberId } },
    });
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Registration not found." }, { status: 404 });
    }
    throw err;
  }
}
