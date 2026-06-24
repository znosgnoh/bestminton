import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireDatabase } from "@/lib/apiHelpers";
import { getAllDebts } from "@/lib/drinkDebt";

export const dynamic = "force-dynamic";

export async function GET() {
  const unavailable = requireDatabase();
  if (unavailable) return unavailable;

  try {
    const debts = await getAllDebts();
    return NextResponse.json(debts);
  } catch {
    return NextResponse.json({ error: "Database unavailable." }, { status: 503 });
  }
}
