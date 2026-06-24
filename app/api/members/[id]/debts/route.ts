import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDatabase } from "@/lib/apiHelpers";
import { getMemberDebts } from "@/lib/drinkDebt";
import { memberToDTO } from "@/lib/memberSerialize";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  const { id: idStr } = await params;
  const memberId = parseInt(idStr);
  if (isNaN(memberId)) {
    return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
  }

  try {
    const member = await db.member.findUnique({ where: { id: memberId } });
    if (!member) {
      return NextResponse.json({ error: "Member not found." }, { status: 404 });
    }

    const debts = await getMemberDebts(memberId);
    const memberDto = await memberToDTO(member);

    return NextResponse.json({ member: memberDto, ...debts });
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
