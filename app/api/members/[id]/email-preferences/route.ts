import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberPinFromRequest, requireDatabase, requireMemberPin } from "@/lib/apiHelpers";
import { memberToDTO } from "@/lib/memberSerialize";
import { revalidateMemberPages } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  const { id: idStr } = await params;
  const id = parseInt(idStr);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid member ID." }, { status: 400 });
  }

  let body: { emailNotificationsEnabled?: boolean; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireMemberPin(memberPinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  if (typeof body.emailNotificationsEnabled !== "boolean") {
    return NextResponse.json(
      { error: "emailNotificationsEnabled must be a boolean." },
      { status: 400 }
    );
  }

  const existing = await db.member.findUnique({ where: { id }, select: { id: true } });
  if (!existing) {
    return NextResponse.json({ error: "Member not found." }, { status: 404 });
  }

  const member = await db.member.update({
    where: { id },
    data: { emailNotificationsEnabled: body.emailNotificationsEnabled },
  });
  revalidateMemberPages(id);
  return NextResponse.json(await memberToDTO(member));
}
