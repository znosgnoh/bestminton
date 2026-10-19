import { NextRequest, NextResponse } from "next/server";
import { databaseErrorResponse, requireDatabase } from "@/lib/apiHelpers";
import { runMatchReminderCron, runMonthlyDebtReminderCron } from "@/lib/email/events";

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
    // Month-end court-money reminder runs from this same daily job so Hobby
    // stays at two vercel.json cron entries (stale-challenges + this route).
    const [reminders, monthlyDebt] = await Promise.all([
      runMatchReminderCron(),
      runMonthlyDebtReminderCron(),
    ]);
    return NextResponse.json({ reminders, monthlyDebt });
  } catch (err) {
    return databaseErrorResponse(err, "GET /api/cron/match-reminders");
  }
}
