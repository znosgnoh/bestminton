import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse, requireDatabase } from "@/lib/apiHelpers";
import { purgeStalePendingChallenges } from "@/lib/challengeService";
import { revalidateChallengePages } from "@/lib/revalidate";

export const dynamic = "force-dynamic";

function isAuthorizedCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    return request.headers.get("authorization") === `Bearer ${secret}`;
  }
  return (
    request.headers.get("x-vercel-cron") === "1" || process.env.NODE_ENV !== "production"
  );
}

export async function GET(request: NextRequest) {
  if (!isAuthorizedCron(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  try {
    const deleted = await purgeStalePendingChallenges();
    if (deleted > 0) revalidateChallengePages();
    return NextResponse.json({ deleted });
  } catch (err) {
    return databaseErrorResponse(err, "GET /api/cron/stale-challenges");
  }
}
