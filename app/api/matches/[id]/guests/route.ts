import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

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

  let body: { memberId?: number; label?: string; playedFull?: boolean };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const memberId = Number(body.memberId);
  if (!memberId || isNaN(memberId)) {
    return NextResponse.json({ error: "memberId is required." }, { status: 400 });
  }

  const registration = await db.matchRegistration.findUnique({
    where: { matchId_memberId: { matchId, memberId } },
  });
  if (!registration) {
    return NextResponse.json(
      { error: "Player is not registered for this match." },
      { status: 404 }
    );
  }

  await db.guest.create({
    data: {
      registrationId: registration.id,
      label: body.label?.trim() || null,
      playedFull: body.playedFull ?? true,
    },
  });

  // Return the full updated registration so the client has the authoritative state
  const updated = await db.matchRegistration.findUnique({
    where: { id: registration.id },
    include: REG_INCLUDE,
  });

  return NextResponse.json(JSON.parse(JSON.stringify(updated)), { status: 201 });
}
