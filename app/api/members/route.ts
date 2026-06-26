import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pinFromRequest, requireAdminPin } from "@/lib/apiHelpers";
import { revalidateMemberPages } from "@/lib/revalidate";
import { memberToDTO, membersToDTOs } from "@/lib/memberSerialize";
import { Prisma } from "@prisma/client";

export const revalidate = 30;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
};

export async function GET() {
  const members = await db.member.findMany({ orderBy: { name: "asc" } });
  const dtos = await membersToDTOs(members);
  return NextResponse.json(dtos, { headers: CACHE_HEADERS });
}

export async function POST(request: NextRequest) {
  let body: { name?: string; avatarUrl?: string; splitwiseId?: number; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  const name = typeof body.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "Name is required." }, { status: 400 });
  }

  const splitwiseId =
    body.splitwiseId !== undefined && body.splitwiseId !== null
      ? Number(body.splitwiseId)
      : null;
  if (splitwiseId !== null && (!Number.isInteger(splitwiseId) || splitwiseId <= 0)) {
    return NextResponse.json(
      { error: "splitwiseId must be a positive integer." },
      { status: 400 }
    );
  }

  try {
    const member = await db.member.create({
      data: {
        name,
        avatarUrl: body.avatarUrl?.trim() || null,
        splitwiseId,
      },
    });
    revalidateMemberPages();
    return NextResponse.json(await memberToDTO(member), { status: 201 });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return NextResponse.json(
        { error: "A member with this Splitwise ID already exists." },
        { status: 409 }
      );
    }
    throw err;
  }
}
