export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export function getEmailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || "Bestminton <onboarding@resend.dev>";
}

export function getAppBaseUrl(): string {
  const raw = process.env.APP_BASE_URL?.trim() || "http://localhost:3000";
  return raw.replace(/\/$/, "");
}
