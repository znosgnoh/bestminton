import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidateMatchPages } from "@/lib/revalidate";
import {
  requireMatchCapacityAccess,
  requireRegistrationEditAccess,
} from "@/lib/apiHelpers";
import { matchHeadcount } from "@/lib/matchCapacity";

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

  let body: { memberId?: number; label?: string; playedFull?: boolean; pin?: string };
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

  const pinDenied = requireRegistrationEditAccess(request, match, body);
  if (pinDenied) return pinDenied;

  const registration = await db.matchRegistration.findUnique({
    where: { matchId_memberId: { matchId, memberId } },
  });
  if (!registration) {
    return NextResponse.json(
      { error: "Player is not registered for this match." },
      { status: 404 }
    );
  }

  const regs = await db.matchRegistration.findMany({
    where: { matchId },
    include: { guests: { select: { id: true } } },
  });
  const capacityDenied = requireMatchCapacityAccess(
    request,
    match,
    matchHeadcount(regs),
    body,
    1
  );
  if (capacityDenied) return capacityDenied;

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

  revalidateMatchPages(matchId);
  return NextResponse.json(JSON.parse(JSON.stringify(updated)), { status: 201 });
}
