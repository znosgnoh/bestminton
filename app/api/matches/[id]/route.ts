import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { MATCH_FULL_INCLUDE } from "@/lib/prismaIncludes";
import { revalidateMatchPages } from "@/lib/revalidate";
import { toDTO } from "@/lib/serialize";

export const revalidate = 30;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
};

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid match ID." }, { status: 400 });
  }

  const match = await db.match.findUnique({ where: { id }, include: MATCH_FULL_INCLUDE });
  if (!match) {
    return NextResponse.json({ error: "Match not found." }, { status: 404 });
  }
  return NextResponse.json(toDTO(match), { headers: CACHE_HEADERS });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid match ID." }, { status: 400 });
  }

  let body: {
    title?: string;
    venue?: string;
    scheduledAt?: string;
    hours?: number | null;
    totalCost?: number | null;
    paidByMemberId?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  try {
    const existing = await db.match.findUniqueOrThrow({ where: { id } });

    const settlementFields = ["hours", "totalCost", "paidByMemberId"] as const;
    if (existing.synced && settlementFields.some((f) => f in body)) {
      return NextResponse.json(
        { error: "Cannot modify settlement data for a synced match." },
        { status: 422 }
      );
    }

    const data: Prisma.MatchUpdateInput = {};
    if (body.title !== undefined) data.title = body.title.trim();
    if (body.venue !== undefined) data.venue = body.venue.trim();
    if (body.scheduledAt !== undefined) {
      const d = new Date(body.scheduledAt);
      if (isNaN(d.getTime())) {
        return NextResponse.json({ error: "Invalid scheduledAt date." }, { status: 400 });
      }
      data.scheduledAt = d;
    }
    if (body.hours !== undefined) data.hours = body.hours;
    if (body.totalCost !== undefined) data.totalCost = body.totalCost;
    if (body.paidByMemberId !== undefined) {
      data.paidBy = body.paidByMemberId
        ? { connect: { id: body.paidByMemberId } }
        : { disconnect: true };
    }

    const match = await db.match.update({ where: { id }, data, include: MATCH_FULL_INCLUDE });
    revalidateMatchPages(id);
    return NextResponse.json(toDTO(match));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid match ID." }, { status: 400 });
  }

  let body: { confirmSynced?: boolean } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    // No body is fine for DELETE
  }

  try {
    const existing = await db.match.findUniqueOrThrow({ where: { id } });
    if (existing.synced && !body.confirmSynced) {
      return NextResponse.json(
        {
          error:
            "This match has been synced to Splitwise. Pass confirmSynced: true to delete anyway.",
        },
        { status: 409 }
      );
    }

    await db.match.delete({ where: { id } });
    revalidateMatchPages(id);
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Match not found." }, { status: 404 });
    }
    throw err;
  }
}
