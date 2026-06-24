import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPin } from "@/lib/adminPin";
import { DEFAULT_ELO } from "@/lib/elo";
import { requireDatabase } from "@/lib/apiHelpers";
import { db } from "@/lib/db";
import { revalidateMemberPages } from "@/lib/revalidate";
import type { ResetEloRequest } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  let body: ResetEloRequest = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinCheck = verifyAdminPin(body.pin);
  if (!pinCheck.ok) {
    const status = pinCheck.error === "missing" ? 403 : 401;
    const message = pinCheck.error === "missing" ? "PIN required." : "Invalid PIN.";
    return NextResponse.json({ error: message }, { status });
  }

  try {
    const result = await db.member.updateMany({
      data: { eloRating: DEFAULT_ELO },
    });

    revalidateMemberPages();

    return NextResponse.json({ count: result.count });
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
