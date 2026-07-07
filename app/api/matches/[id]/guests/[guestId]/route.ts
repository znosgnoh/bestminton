import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidateMatchPages } from "@/lib/revalidate";
import { requirePastMatchAdminPin } from "@/lib/apiHelpers";
import { Prisma } from "@prisma/client";

const REG_INCLUDE = { member: true, guests: true };

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> }
) {
  const { id: idStr, guestId: guestIdStr } = await params;
  const matchId = parseInt(idStr);
  const guestId = parseInt(guestIdStr);
  if (isNaN(guestId)) {
    return NextResponse.json({ error: "Invalid guest ID." }, { status: 400 });
  }

  let body: { playedFull?: boolean; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }
  if (typeof body.playedFull !== "boolean") {
    return NextResponse.json({ error: "playedFull (boolean) is required." }, { status: 400 });
  }

  try {
    const existing = await db.guest.findUnique({
      where: { id: guestId },
      include: { registration: { include: { match: true } } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }

    const pinDenied = requirePastMatchAdminPin(
      request,
      existing.registration.match.scheduledAt,
      body
    );
    if (pinDenied) return pinDenied;

    const guest = await db.guest.update({
      where: { id: guestId },
      data: { playedFull: body.playedFull },
    });

    // Return the full updated registration
    const updated = await db.matchRegistration.findUnique({
      where: { id: guest.registrationId },
      include: REG_INCLUDE,
    });
    if (!isNaN(matchId)) revalidateMatchPages(matchId);
    return NextResponse.json(JSON.parse(JSON.stringify(updated)));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }
    throw err;
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; guestId: string }> }
) {
  const { id: idStr, guestId: guestIdStr } = await params;
  const matchId = parseInt(idStr);
  const guestId = parseInt(guestIdStr);
  if (isNaN(guestId)) {
    return NextResponse.json({ error: "Invalid guest ID." }, { status: 400 });
  }

  let body: { pin?: string } = {};
  try {
    body = await request.json();
  } catch {
    // DELETE may have no body; PIN can still come from header
  }

  try {
    const guest = await db.guest.findUnique({
      where: { id: guestId },
      include: { registration: { include: { match: true } } },
    });
    if (!guest) {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }

    const pinDenied = requirePastMatchAdminPin(
      request,
      guest.registration.match.scheduledAt,
      body
    );
    if (pinDenied) return pinDenied;

    const registrationId = guest.registrationId;

    await db.guest.delete({ where: { id: guestId } });

    const updated = await db.matchRegistration.findUnique({
      where: { id: registrationId },
      include: REG_INCLUDE,
    });
    if (!isNaN(matchId)) revalidateMatchPages(matchId);
    return NextResponse.json(JSON.parse(JSON.stringify(updated)));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Guest not found." }, { status: 404 });
    }
    throw err;
  }
}
