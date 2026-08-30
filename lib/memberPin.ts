/** Default shared PIN for member actions (balances settle, cam, kèo). */
export const DEFAULT_MEMBER_PIN = "12345";

/**
 * MEMBER_PIN from env. Unset → default `12345`.
 * Explicit empty string disables the member PIN gate (local convenience).
 */
export function expectedMemberPin(): string | undefined {
  if (process.env.MEMBER_PIN !== undefined) {
    const trimmed = process.env.MEMBER_PIN.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }
  return DEFAULT_MEMBER_PIN;
}

export function isMemberPinRequired(): boolean {
  return Boolean(expectedMemberPin());
}

export function verifyMemberPin(
  pin?: string
): { ok: true } | { ok: false; error: "missing" | "invalid" } {
  const expected = expectedMemberPin();
  if (!expected) return { ok: true };
  if (!pin) return { ok: false, error: "missing" };
  if (pin !== expected) return { ok: false, error: "invalid" };
  return { ok: true };
}
