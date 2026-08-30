export const MEMBER_UNLOCK_KEY = "bestminton_member_unlocked";
export const MEMBER_PIN_KEY = "bestminton_member_pin";

export function getStoredMemberPin(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return sessionStorage.getItem(MEMBER_PIN_KEY) ?? undefined;
}

export function memberPinHeaders(): Record<string, string> {
  const pin = getStoredMemberPin();
  return pin ? { "X-Member-Pin": pin } : {};
}

export function withMemberPin<T extends object>(data: T): T & { pin?: string } {
  const pin = getStoredMemberPin();
  return pin ? { ...data, pin } : data;
}
