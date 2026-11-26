import { NextRequest, NextResponse } from "next/server";
import { getCachedSessionPlaylist } from "@/lib/youtubePlaylist";

export const dynamic = "force-dynamic";
export const preferredRegion = "sin1";

export async function GET(request: NextRequest) {
  try {
    const force = request.nextUrl.searchParams.get("refresh") === "1";
    const playlist = await getCachedSessionPlaylist(undefined, { force });
    return NextResponse.json(playlist, {
      headers: {
        "Cache-Control": force
          ? "no-store"
          : "public, s-maxage=900, stale-while-revalidate=1800",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load playlist.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
