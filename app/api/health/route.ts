import { NextResponse } from "next/server";
import { probeDatabase } from "@/lib/dbHealth";

export const dynamic = "force-dynamic";

export async function GET() {
  const probe = await probeDatabase();
  if (probe.ok) {
    return NextResponse.json({ db: true });
  }

  return NextResponse.json({
    db: false,
    reason: probe.reason,
    ...(process.env.NODE_ENV === "development" ? { detail: probe.message } : {}),
  });
}
