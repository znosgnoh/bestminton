import { NextRequest, NextResponse } from "next/server";
import { pinFromRequest, requireAdminPin } from "@/lib/apiHelpers";
import { isSplitwiseConfigured } from "@/lib/splitwise";
import { syncMemberEmailsFromSplitwise } from "@/lib/syncMemberEmails";
import { SplitwiseGroupFetchError } from "@/lib/splitwiseGroupMembers";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let body: { pin?: string } = {};
  try {
    const text = await request.text();
    if (text.trim()) body = JSON.parse(text) as { pin?: string };
  } catch {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const pinDenied = requireAdminPin(pinFromRequest(request, body));
  if (pinDenied) return pinDenied;

  if (!isSplitwiseConfigured()) {
    return NextResponse.json(
      {
        error:
          "Splitwise is not configured. Add SPLITWISE_API_KEY and SPLITWISE_GROUP_ID to your environment.",
      },
      { status: 503 }
    );
  }

  try {
    const result = await syncMemberEmailsFromSplitwise();
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof SplitwiseGroupFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
