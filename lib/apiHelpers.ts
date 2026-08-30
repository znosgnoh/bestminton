import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPin } from "@/lib/adminPin";
import { verifyMemberPin } from "@/lib/memberPin";
import { formatDatabaseError, logDatabaseError } from "@/lib/dbHealth";
import { isDatabaseConfigured } from "@/lib/dbConfig";

export function pinFromRequest(
  request: NextRequest,
  body?: { pin?: string }
): string | undefined {
  return body?.pin ?? request.headers.get("x-captain-pin") ?? undefined;
}

export function memberPinFromRequest(
  request: NextRequest,
  body?: { pin?: string }
): string | undefined {
  return body?.pin ?? request.headers.get("x-member-pin") ?? undefined;
}

function pinCheckResponse(
  pinCheck: { ok: true } | { ok: false; error: "missing" | "invalid" }
) {
  if (pinCheck.ok) return null;
  const status = pinCheck.error === "missing" ? 403 : 401;
  const message = pinCheck.error === "missing" ? "PIN required." : "Invalid PIN.";
  return NextResponse.json({ error: message }, { status });
}

export function requireAdminPin(pin?: string) {
  return pinCheckResponse(verifyAdminPin(pin));
}

/** Balances settle, cam settle, and kèo admin actions. */
export function requireMemberPin(pin?: string) {
  return pinCheckResponse(verifyMemberPin(pin));
}

/** Past-match registration edits require captain PIN when CAPTAIN_PIN is set. */
export function requirePastMatchAdminPin(
  request: NextRequest,
  scheduledAt: Date | string,
  body?: { pin?: string }
) {
  if (new Date(scheduledAt) >= new Date()) return null;
  return requireAdminPin(pinFromRequest(request, body));
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
