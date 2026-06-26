import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPin } from "@/lib/adminPin";
import { formatDatabaseError, logDatabaseError } from "@/lib/dbHealth";
import { isDatabaseConfigured } from "@/lib/dbConfig";

export function pinFromRequest(
  request: NextRequest,
  body?: { pin?: string }
): string | undefined {
  return body?.pin ?? request.headers.get("x-captain-pin") ?? undefined;
}

export function requireAdminPin(pin?: string) {
  const pinCheck = verifyAdminPin(pin);
  if (!pinCheck.ok) {
    const status = pinCheck.error === "missing" ? 403 : 401;
    const message = pinCheck.error === "missing" ? "PIN required." : "Invalid PIN.";
    return NextResponse.json({ error: message }, { status });
  }
  return null;
}

export function requireDatabase() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json(
      {
        error:
          "POSTGRES_PRISMA_URL is not set. Configure Postgres env vars for kèo and leaderboard features.",
      },
      { status: 503 }
    );
  }
  return null;
}

/** Log the real error in dev; return a useful 503 to clients when possible. */
export function databaseErrorResponse(err: unknown, context?: string) {
  logDatabaseError(context ?? "database", err);

  const payload: { error: string; detail?: string } = {
    error: formatDatabaseError(err),
  };

  if (process.env.NODE_ENV === "development" && err instanceof Error) {
    payload.detail = err.message;
  }

  return NextResponse.json(payload, { status: 503 });
}
