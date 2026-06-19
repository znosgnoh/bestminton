const SPLITWISE_BASE = "https://secure.splitwise.com/api/v3.0";

export function isSplitwiseConfigured(): boolean {
  return Boolean(process.env.SPLITWISE_API_KEY && process.env.SPLITWISE_GROUP_ID);
}

function getApiKey(): string {
  const key = process.env.SPLITWISE_API_KEY;
  if (!key) throw new Error("SPLITWISE_API_KEY is not configured.");
  return key;
}

export function getGroupId(): string {
  const id = process.env.SPLITWISE_GROUP_ID;
  if (!id) throw new Error("SPLITWISE_GROUP_ID is not configured.");
  return id;
}

export async function splitwiseFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const apiKey = getApiKey();
  return fetch(`${SPLITWISE_BASE}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...options.headers,
    },
  });
}
