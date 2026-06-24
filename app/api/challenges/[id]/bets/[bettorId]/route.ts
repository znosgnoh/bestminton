import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDatabase } from "@/lib/apiHelpers";
import { CHALLENGE_FULL_INCLUDE } from "@/lib/challengeIncludes";
import { serializeChallenge } from "@/lib/challengeSerialize";
import { revalidateChallengePages } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; bettorId: string }> }
) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  const { id: idStr, bettorId: bettorIdStr } = await params;
  const challengeId = parseInt(idStr);
  const bettorId = parseInt(bettorIdStr);

  if (isNaN(challengeId) || isNaN(bettorId)) {
    return NextResponse.json({ error: "Invalid IDs." }, { status: 400 });
  }

  try {
    const challenge = await db.challenge.findUnique({ where: { id: challengeId } });
    if (!challenge) {
      return NextResponse.json({ error: "Không tìm thấy kèo." }, { status: 404 });
    }
    if (challenge.status !== "PENDING") {
      return NextResponse.json(
        { error: "Chỉ có thể hủy cược khi kèo đang chờ gạ." },
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
