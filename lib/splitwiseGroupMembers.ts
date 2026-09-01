import {
  getGroupId,
  hasSplitwiseErrors,
  parseSplitwiseErrors,
  splitwiseFetch,
  splitwiseMemberName,
  type SplitwiseGroupResponse,
} from "./splitwise";
import type { SplitwiseMember } from "./types";

export class SplitwiseGroupFetchError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "SplitwiseGroupFetchError";
  }
}

export async function fetchSplitwiseGroupMembers(): Promise<SplitwiseMember[]> {
  const groupId = getGroupId();

  let res: Response;
  try {
    res = await splitwiseFetch(`/get_group/${groupId}`);
  } catch {
    throw new SplitwiseGroupFetchError(
      "Could not reach Splitwise. Please check your connection.",
      502
    );
  }

  let data: SplitwiseGroupResponse;
  try {
    data = (await res.json()) as SplitwiseGroupResponse;
  } catch {
    throw new SplitwiseGroupFetchError("Splitwise returned an invalid group response.", 502);
  }

  const splitwiseError = parseSplitwiseErrors(data.errors);
  if (!res.ok || hasSplitwiseErrors(data)) {
    if (res.status === 401) {
      throw new SplitwiseGroupFetchError("Invalid Splitwise API key.", 401);
    }
    if (res.status === 404) {
      throw new SplitwiseGroupFetchError("Splitwise group not found.", 404);
    }
    throw new SplitwiseGroupFetchError(
      splitwiseError ?? `Could not load Splitwise group ${groupId}.`,
      res.ok ? 422 : res.status
    );
  }

  return (data.group?.members ?? [])
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
}
