export function isPinRequired(): boolean {
  return Boolean(process.env.CAPTAIN_PIN ?? process.env.ADMIN_PIN);
}

export function verifyAdminPin(pin?: string): { ok: true } | { ok: false; error: "missing" | "invalid" } {
  const expected = process.env.CAPTAIN_PIN ?? process.env.ADMIN_PIN;
  if (!expected) return { ok: true };
  if (!pin) return { ok: false, error: "missing" };
  if (pin !== expected) return { ok: false, error: "invalid" };
  return { ok: true };
}
