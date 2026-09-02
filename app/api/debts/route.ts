import { NextResponse } from "next/server";
import { requireDatabase } from "@/lib/apiHelpers";
import { getOjPoolSnapshot } from "@/lib/ojBalance";

export const dynamic = "force-dynamic";

export async function GET() {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  try {
    return NextResponse.json(await getOjPoolSnapshot());
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
