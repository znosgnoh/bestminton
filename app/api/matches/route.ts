import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { pinFromRequest, requireAdminPin } from "@/lib/apiHelpers";
import { MATCH_FULL_INCLUDE } from "@/lib/prismaIncludes";
import { revalidateMatchPages } from "@/lib/revalidate";
import { toDTO } from "@/lib/serialize";

export const revalidate = 30;

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function GET() {
  const matches = await db.match.findMany({
    include: MATCH_FULL_INCLUDE,
    orderBy: { scheduledAt: "asc" },
  });
  return NextResponse.json(toDTO(matches), { headers: CACHE_HEADERS });
}

export async function POST(request: NextRequest) {
  let body: {
    title?: string;
    venue?: string;
    scheduledAt?: string;
    isRecurring?: boolean;
    pin?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const venue = typeof body.venue === "string" ? body.venue.trim() : "";
  const scheduledAtStr = body.scheduledAt ?? "";

  if (!title) return NextResponse.json({ error: "Title is required." }, { status: 400 });
  if (!venue) return NextResponse.json({ error: "Venue is required." }, { status: 400 });

  const scheduledAt = new Date(scheduledAtStr);
  if (isNaN(scheduledAt.getTime())) {
    return NextResponse.json({ error: "Invalid scheduledAt date." }, { status: 400 });
  }

  const isRecurring = Boolean(body.isRecurring);
  const recurDayOfWeek = scheduledAt.getDay();

  if (!isRecurring) {
    const match = await db.match.create({
      data: { title, venue, scheduledAt, isRecurring: false, recurDayOfWeek: null },
      include: MATCH_FULL_INCLUDE,
    });
    revalidateMatchPages(match.id);
    return NextResponse.json(toDTO([match]), { status: 201 });
  }

  const dates = [0, 7, 14, 21].map((offset) => addDays(scheduledAt, offset));
  const created = await db.$transaction(
    dates.map((date) =>
      db.match.create({
        data: { title, venue, scheduledAt: date, isRecurring: true, recurDayOfWeek },
        include: MATCH_FULL_INCLUDE,
      })
    )
  );
  revalidateMatchPages();
  return NextResponse.json(toDTO(created), { status: 201 });
}
