import { NextResponse } from "next/server";
import { isSplitwiseConfigured, splitwiseFetch, getGroupId } from "@/lib/splitwise";
import type { SplitwiseMember } from "@/lib/types";

export async function GET() {
  if (!isSplitwiseConfigured()) {
    return NextResponse.json(
      { error: "Splitwise is not configured. Add SPLITWISE_API_KEY and SPLITWISE_GROUP_ID to .env.local." },
      { status: 503 }
    );
  }

  const groupId = getGroupId();

  let res: Response;
  try {
    res = await splitwiseFetch(`/get_group/${groupId}`);
  } catch {
    return NextResponse.json(
      { error: "Could not reach Splitwise. Please check your connection." },
      { status: 502 }
    );
  }

  if (res.status === 401) {
    return NextResponse.json({ error: "Invalid Splitwise API key." }, { status: 401 });
  }
  if (res.status === 404) {
    return NextResponse.json({ error: "Splitwise group not found." }, { status: 404 });
  }
  if (!res.ok) {
    return NextResponse.json({ error: `Splitwise error: ${res.statusText}` }, { status: res.status });
  }

  const data = await res.json() as { group: { members: SplitwiseMember[] } };
  return NextResponse.json({ members: data.group.members });
}
