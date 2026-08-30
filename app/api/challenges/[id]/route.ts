import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse, requireDatabase, requireMemberPin } from "@/lib/apiHelpers";
import { db } from "@/lib/db";
import { CHALLENGE_FULL_INCLUDE } from "@/lib/challengeIncludes";
import { serializeChallenge } from "@/lib/challengeSerialize";
import {
  adminDeleteChallenge,
  adminEditChallengeWinner,
  purgeStalePendingChallenges,
} from "@/lib/challengeService";
import { sideAverageElo, suggestedHandicap } from "@/lib/elo";
import { revalidateChallengePages, revalidateMemberPages } from "@/lib/revalidate";
import type { AdminDeleteChallengeRequest, AdminEditChallengeRequest, UpdateChallengeRequest } from "@/lib/types";
import { parseYoutubeUrlField } from "@/lib/youtube";

export const dynamic = "force-dynamic";

function parseNotesUpdate(value: unknown): string | null | { error: string } {
  if (value === null) return null;
  if (typeof value !== "string") {
    return { error: "notes must be a string." };
  }
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  if (trimmed.length > 2000) {
    return { error: "notes must be at most 2000 characters." };
  }
  return trimmed;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return NextResponse.json({ error: "ID kèo không hợp lệ." }, { status: 400 });
  }

  try {
    await purgeStalePendingChallenges();
    const challenge = await db.challenge.findUnique({
      where: { id },
      include: CHALLENGE_FULL_INCLUDE,
    });

    if (!challenge) {
      return NextResponse.json({ error: "Không tìm thấy kèo." }, { status: 404 });
    }

    return NextResponse.json(serializeChallenge(challenge));
  } catch (err) {
    return databaseErrorResponse(err, "GET /api/challenges/[id]");
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  const { id: idStr } = await params;
  const challengeId = parseInt(idStr);
  if (isNaN(challengeId)) {
    return NextResponse.json({ error: "ID kèo không hợp lệ." }, { status: 400 });
  }

  let body: UpdateChallengeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (
    body.isDrinkChallenge === undefined &&
    body.pointsToWin === undefined &&
    body.notes === undefined &&
    body.youtubeUrl === undefined
  ) {
    if (body.handicapPoints !== undefined) {
      return NextResponse.json(
        { error: "Handicap is set by the system and cannot be updated." },
        { status: 400 }
      );
    }
    return NextResponse.json({ error: "No fields to update." }, { status: 400 });
  }

  if (body.handicapPoints !== undefined) {
    return NextResponse.json(
      { error: "Handicap is set by the system and cannot be updated." },
      { status: 400 }
    );
  }

  const data: {
    isDrinkChallenge?: boolean;
    handicapPoints?: number;
    pointsToWin?: number;
    notes?: string | null;
    youtubeUrl?: string | null;
  } = {};

  if (body.isDrinkChallenge !== undefined) {
    if (typeof body.isDrinkChallenge !== "boolean") {
      return NextResponse.json({ error: "isDrinkChallenge must be a boolean." }, { status: 400 });
    }
    data.isDrinkChallenge = body.isDrinkChallenge;
  }

  if (body.pointsToWin !== undefined) {
    const parsed = Number(body.pointsToWin);
    if (parsed !== 15 && parsed !== 21) {
      return NextResponse.json({ error: "pointsToWin must be 15 or 21." }, { status: 400 });
    }
    data.pointsToWin = parsed;
  }

  if (body.youtubeUrl !== undefined) {
    const parsed = parseYoutubeUrlField(body.youtubeUrl);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    data.youtubeUrl = parsed.url;
  }

  if (body.notes !== undefined) {
    const notesResult = parseNotesUpdate(body.notes);
    if (notesResult !== null && typeof notesResult === "object" && "error" in notesResult) {
      return NextResponse.json({ error: notesResult.error }, { status: 400 });
    }
    data.notes = notesResult;
  }

  const youtubeOnly =
    data.youtubeUrl !== undefined &&
    data.isDrinkChallenge === undefined &&
    data.handicapPoints === undefined &&
    data.pointsToWin === undefined &&
    data.notes === undefined;

  try {
    const existing = await db.challenge.findUnique({
      where: { id: challengeId },
      select: {
        status: true,
        format: true,
        pointsToWin: true,
        playerA: { select: { eloRating: true } },
        playerA2: { select: { eloRating: true } },
        playerB: { select: { eloRating: true } },
        playerB2: { select: { eloRating: true } },
      },
    });

    if (!existing) {
      return NextResponse.json({ error: "Không tìm thấy kèo." }, { status: 404 });
    }

    if (existing.status !== "PENDING" && !youtubeOnly) {
      return NextResponse.json(
        { error: "Chỉ có thể đổi cài đặt kèo trước khi trận bắt đầu." },
        { status: 409 }
      );
    }

    if (data.pointsToWin !== undefined) {
      const sideARatings =
        existing.format === "DOUBLES" && existing.playerA2
          ? [existing.playerA.eloRating, existing.playerA2.eloRating]
          : [existing.playerA.eloRating];
      const sideBRatings =
        existing.format === "DOUBLES" && existing.playerB2
          ? [existing.playerB.eloRating, existing.playerB2.eloRating]
          : [existing.playerB.eloRating];
      data.handicapPoints = suggestedHandicap(
        sideAverageElo(sideARatings),
        sideAverageElo(sideBRatings),
        data.pointsToWin
      );
    }

    const updated = await db.challenge.update({
      where: { id: challengeId },
      data,
      include: CHALLENGE_FULL_INCLUDE,
    });

    revalidateChallengePages(challengeId);
    return NextResponse.json(serializeChallenge(updated));
  } catch (err) {
    return databaseErrorResponse(err, "PATCH /api/challenges/[id]");
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  const { id: idStr } = await params;
  const challengeId = parseInt(idStr);
  if (isNaN(challengeId)) {
    return NextResponse.json({ error: "ID kèo không hợp lệ." }, { status: 400 });
  }

  let body: AdminEditChallengeRequest;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  if (body.winnerSide !== "A" && body.winnerSide !== "B") {
    return NextResponse.json({ error: "winnerSide must be A or B." }, { status: 400 });
  }

  const pinDenied = requireMemberPin(body.pin);
  if (pinDenied) return pinDenied;

  try {
    const updated = await adminEditChallengeWinner(challengeId, body.winnerSide);
    revalidateChallengePages(challengeId);
    revalidateMemberPages();
    return NextResponse.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy kèo." }, { status: 404 });
    }
    if (message === "INVALID_STATUS") {
      return NextResponse.json(
        { error: "Chỉ có thể sửa người thắng của kèo đã xong." },
        { status: 409 }
      );
    }
    if (message === "SAME_WINNER") {
      return NextResponse.json({ error: "Winner is already set to that side." }, { status: 409 });
    }
    if (message === "NO_SNAPSHOT") {
      return NextResponse.json(
        { error: "Kèo không có dữ liệu chốt — hãy sửa Elo thành viên thủ công." },
        { status: 409 }
      );
    }
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
    return NextResponse.json({ error: "ID kèo không hợp lệ." }, { status: 400 });
  }

  let body: AdminDeleteChallengeRequest = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text) as AdminDeleteChallengeRequest;
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireMemberPin(body.pin);
  if (pinDenied) return pinDenied;

  try {
    const challenge = await db.challenge.findUnique({
      where: { id: challengeId },
      select: { resolutionSnapshot: true },
    });
    if (!challenge) {
      return NextResponse.json({ error: "Không tìm thấy kèo." }, { status: 404 });
    }

    const snapshot = challenge.resolutionSnapshot as { debts?: unknown[] } | null;
    const debtCount = snapshot?.debts?.length ?? 0;
    if (debtCount > 0 && !body.confirmDebts) {
      return NextResponse.json(
        {
          error: `Kèo này đã tạo ${debtCount} bản ghi nợ nước cam. Xác nhận xóa để tiếp tục — nợ trong sổ sẽ KHÔNG được hoàn tác.`,
          debtCount,
          requiresConfirm: true,
        },
        { status: 409 }
      );
    }

    const result = await adminDeleteChallenge(challengeId);
    revalidateChallengePages(challengeId);
    revalidateMemberPages();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "";
    if (message === "NOT_FOUND") {
      return NextResponse.json({ error: "Không tìm thấy kèo." }, { status: 404 });
    }
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
