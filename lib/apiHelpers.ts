import { NextResponse } from "next/server";
import { isDatabaseConfigured } from "@/lib/dbConfig";

export function requireDatabase() {
  if (!isDatabaseConfigured()) {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
  return null;
}

/** Log the real error in dev; return a generic 503 to clients. */
export function databaseErrorResponse(err: unknown, context?: string) {
  const label = context ? `[${context}]` : "[database]";
  if (process.env.NODE_ENV === "development") {
    console.error(label, err);
  }

  const payload: { error: string; detail?: string } = { error: "Database unavailable." };
  if (process.env.NODE_ENV === "development" && err instanceof Error) {
    payload.detail = err.message;
  }

  return NextResponse.json(payload, { status: 503 });
}
