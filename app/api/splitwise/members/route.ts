import { NextRequest, NextResponse } from "next/server";
import { isSplitwiseConfigured } from "@/lib/splitwise";
import { pinFromRequest, requireAdminPin } from "@/lib/apiHelpers";
import {
  fetchSplitwiseGroupMembers,
  SplitwiseGroupFetchError,
} from "@/lib/splitwiseGroupMembers";

export async function GET(request: NextRequest) {
  const pinDenied = requireAdminPin(pinFromRequest(request));
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
    const members = await fetchSplitwiseGroupMembers();
    return NextResponse.json({
      members,
      group: null,
    });
  } catch (err) {
    if (err instanceof SplitwiseGroupFetchError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    throw err;
  }
}
