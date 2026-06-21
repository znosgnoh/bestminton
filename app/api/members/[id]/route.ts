import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { revalidateMemberPages } from "@/lib/revalidate";
import { Prisma } from "@prisma/client";

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
  }

  let body: { name?: string; avatarUrl?: string; splitwiseId?: number | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

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

  try {
    const member = await db.member.update({
      where: { id },
      data: {
        ...(name !== undefined && { name }),
        ...(body.avatarUrl !== undefined && { avatarUrl: body.avatarUrl?.trim() || null }),
        ...(splitwiseId !== undefined && { splitwiseId }),
      },
    });
    revalidateMemberPages();
    return NextResponse.json(member);
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
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
  }

  const regCount = await db.matchRegistration.count({ where: { memberId: id } });
  if (regCount > 0) {
    return NextResponse.json(
      { error: "Member has existing registrations and cannot be deleted." },
      { status: 409 }
    );
  }

  try {
    await db.member.delete({ where: { id } });
    revalidateMemberPages();
    return NextResponse.json({ success: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }
    throw err;
  }
}
