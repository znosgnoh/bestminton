export const ADMIN_UNLOCK_KEY = "bestminton_admin_unlocked";
export const ADMIN_PIN_KEY = "bestminton_admin_pin";

export function getStoredAdminPin(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return sessionStorage.getItem(ADMIN_PIN_KEY) ?? undefined;
}

export function adminPinHeaders(): Record<string, string> {
  const pin = getStoredAdminPin();
  return pin ? { "X-Captain-Pin": pin } : {};
}

export function withAdminPin<T extends object>(data: T): T & { pin?: string } {
  const pin = getStoredAdminPin();
  return pin ? { ...data, pin } : data;
}
