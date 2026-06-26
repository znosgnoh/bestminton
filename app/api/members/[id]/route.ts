import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pinFromRequest, requireAdminPin } from "@/lib/apiHelpers";
import { revalidateMemberPages } from "@/lib/revalidate";
import { memberToDTO } from "@/lib/memberSerialize";
import { Prisma } from "@prisma/client";

function parseOptionalInt(
  value: unknown,
  field: string
): { ok: true; value: number } | { ok: false; error: string } {
  const n = Number(value);
  if (!Number.isInteger(n)) {
    return { ok: false, error: `${field} must be an integer.` };
  }
  return { ok: true, value: n };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
  }

  let body: {
    name?: string;
    avatarUrl?: string;
    splitwiseId?: number | null;
    eloRating?: number;
    totalMatches?: number;
    totalWins?: number;
    pin?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  const name = typeof body.name === "string" ? body.name.trim() : undefined;
  if (name !== undefined && !name) {
    return NextResponse.json({ error: "Name cannot be empty." }, { status: 400 });
  }

  const splitwiseId =
    body.splitwiseId !== undefined
      ? body.splitwiseId === null
        ? null
        : Number(body.splitwiseId)
      : undefined;
  if (
    splitwiseId !== undefined &&
    splitwiseId !== null &&
    (!Number.isInteger(splitwiseId) || splitwiseId <= 0)
  ) {
    return NextResponse.json(
      { error: "splitwiseId must be a positive integer." },
      { status: 400 }
    );
  }

  let eloRating: number | undefined;
  let totalMatches: number | undefined;
  let totalWins: number | undefined;

  if (body.eloRating !== undefined) {
    const parsed = parseOptionalInt(body.eloRating, "eloRating");
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (parsed.value < 100 || parsed.value > 3000) {
      return NextResponse.json(
        { error: "eloRating must be between 100 and 3000." },
        { status: 400 }
      );
    }
    eloRating = parsed.value;
  }

  if (body.totalMatches !== undefined) {
    const parsed = parseOptionalInt(body.totalMatches, "totalMatches");
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (parsed.value < 0) {
      return NextResponse.json({ error: "totalMatches cannot be negative." }, { status: 400 });
    }
    totalMatches = parsed.value;
  }

  if (body.totalWins !== undefined) {
    const parsed = parseOptionalInt(body.totalWins, "totalWins");
    if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 });
    if (parsed.value < 0) {
      return NextResponse.json({ error: "totalWins cannot be negative." }, { status: 400 });
    }
    totalWins = parsed.value;
  }

  if (totalWins !== undefined && totalMatches !== undefined && totalWins > totalMatches) {
    return NextResponse.json(
      { error: "totalWins cannot exceed totalMatches." },
      { status: 400 }
    );
  }

  if (totalWins !== undefined && totalMatches === undefined) {
    const existing = await db.member.findUnique({
      where: { id },
      select: { totalMatches: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    if (totalWins > existing.totalMatches) {
      return NextResponse.json(
        { error: "totalWins cannot exceed totalMatches." },
        { status: 400 }
      );
    }
  }

  if (totalMatches !== undefined && totalWins === undefined) {
    const existing = await db.member.findUnique({
      where: { id },
      select: { totalWins: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    if (existing.totalWins > totalMatches) {
      return NextResponse.json(
        { error: "totalMatches cannot be less than totalWins." },
        { status: 400 }
      );
    }
  }

  try {
    const member = await db.member.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl?.trim() || null }),
        ...(splitwiseId !== undefined && { splitwiseId }),
        ...(eloRating !== undefined && { eloRating }),
        ...(totalMatches !== undefined && { totalMatches }),
        ...(totalWins !== undefined && { totalWins }),
      },
    });
    revalidateMemberPages();
    return NextResponse.json(await memberToDTO(member));
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }
      if (err.code === "P2002") {
        return NextResponse.json(
          { error: "A member with this Splitwise ID already exists." },
          { status: 409 }
        );
      }
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
    return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
  }

  let body: { pin?: string } = {};
  try {
    const text = await request.text();
    if (text) body = JSON.parse(text);
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  const member = await db.member.findUnique({ where: { id }, select: { id: true } });
  if (!member) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const regCount = await db.matchRegistration.count({ where: { memberId: id } });
  if (regCount > 0) {
    return NextResponse.json(
      { error: "Member has match registrations — unregister them first." },
      { status: 409 }
    );
  }

  const activeChallengeCount = await db.challenge.count({
    where: {
      status: { in: ["PENDING", "ACTIVE"] },
      OR: [
        { playerAId: id },
        { playerA2Id: id },
        { playerBId: id },
        { playerB2Id: id },
      ],
    },
  });
  if (activeChallengeCount > 0) {
    return NextResponse.json(
      { error: "Thành viên đang trong kèo chờ gạ hoặc đang đấu — hãy chốt hoặc gỡ họ trước." },
      { status: 409 }
    );
  }

  const challengeHistoryCount = await db.challenge.count({
    where: { OR: [{ playerAId: id }, { playerBId: id }] },
  });
  if (challengeHistoryCount > 0) {
    return NextResponse.json(
      {
        error:
          "Thành viên là tay chính trong lịch sử kèo và không thể xóa.",
      },
      { status: 409 }
    );
  }

  try {
    await db.$transaction(async (tx) => {
      await tx.bet.deleteMany({
        where: { OR: [{ bettorId: id }, { counterpartyId: id }] },
      });
      await tx.drinkDebt.deleteMany({
        where: { OR: [{ debtorId: id }, { creditorId: id }] },
      });
      await tx.match.updateMany({
        where: { paidByMemberId: id },
        data: { paidByMemberId: null },
      });
      await tx.challenge.updateMany({
        where: { winnerId: id },
        data: { winnerId: null },
      });
      await tx.challenge.updateMany({
        where: { playerA2Id: id },
        data: { playerA2Id: null },
      });
      await tx.challenge.updateMany({
        where: { playerB2Id: id },
        data: { playerB2Id: null },
      });
      await tx.member.delete({ where: { id } });
    });
    revalidateMemberPages();
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json({ error: "Member not found." }, { status: 404 });
      }
      if (err.code === "P2003") {
        return NextResponse.json(
          {
            error:
              "Thành viên vẫn còn dữ liệu liên kết và không thể xóa. Hãy gỡ cược, nợ hoặc liên kết kèo trước.",
          },
          { status: 409 }
        );
      }
    }
    throw err;
  }
}
