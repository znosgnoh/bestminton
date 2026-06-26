import { NextRequest, NextResponse } from "next/server";
import {
  isSplitwiseConfigured,
  splitwiseFetch,
  getGroupId,
  parseSplitwiseErrors,
  hasSplitwiseErrors,
  splitwiseMemberName,
  type SplitwiseGroupResponse,
} from "@/lib/splitwise";
import { pinFromRequest, requireAdminPin } from "@/lib/apiHelpers";
import type { SplitwiseMember } from "@/lib/types";

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

  let data: SplitwiseGroupResponse;
  try {
    data = (await res.json()) as SplitwiseGroupResponse;
  } catch {
    return NextResponse.json(
      { error: "Splitwise returned an invalid response." },
      { status: 502 }
    );
  }

  const splitwiseError = parseSplitwiseErrors(data.errors);
  if (!res.ok || hasSplitwiseErrors(data)) {
    if (res.status === 401) {
      return NextResponse.json({ error: "Invalid Splitwise API key." }, { status: 401 });
    }
    if (res.status === 404) {
      return NextResponse.json({ error: "Splitwise group not found." }, { status: 404 });
    }
    return NextResponse.json(
      { error: splitwiseError ?? `Splitwise error: ${res.statusText}` },
      { status: res.ok ? 422 : res.status }
    );
  }

  const rawMembers = data.group?.members ?? [];
  const members: SplitwiseMember[] = rawMembers
    .filter((m) => m.registration_status !== "dummy")
    .map((m) => ({
      id: m.id,
      first_name: m.first_name,
      last_name: m.last_name ?? "",
      email: m.email,
      picture: {
        small: m.picture?.small ?? "",
        medium: m.picture?.medium ?? "",
        large: m.picture?.large ?? "",
      },
      displayName: splitwiseMemberName(m.first_name, m.last_name),
    }));

  return NextResponse.json({
    members,
    group: data.group ? { id: data.group.id, name: data.group.name } : null,
  });
}
