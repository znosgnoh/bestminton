import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const FULL_INCLUDE = {
  registrations: {
    include: { member: true, guests: true },
    orderBy: { joinedAt: "asc" as const },
  },
};

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export async function GET() {
  const matches = await db.match.findMany({
    include: FULL_INCLUDE,
    orderBy: { scheduledAt: "asc" },
  });
  return NextResponse.json(JSON.parse(JSON.stringify(matches)));
}

export async function POST(request: NextRequest) {
  let body: {
    title?: string;
    venue?: string;
    scheduledAt?: string;
    isRecurring?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

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
      include: FULL_INCLUDE,
    });
    return NextResponse.json(JSON.parse(JSON.stringify([match])), { status: 201 });
  }

  const dates = [0, 7, 14, 21].map((offset) => addDays(scheduledAt, offset));
  const created = await db.$transaction(
    dates.map((date) =>
      db.match.create({
        data: { title, venue, scheduledAt: date, isRecurring: true, recurDayOfWeek },
        include: FULL_INCLUDE,
      })
    )
  );
  return NextResponse.json(JSON.parse(JSON.stringify(created)), { status: 201 });
}
