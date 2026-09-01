import type { RenderedEmail } from "../types";
import { formatMatchDateTime, renderBilingualEmail } from "./layout";

export function renderMatchEmail(input: {
  recipientName: string;
  title: string;
  venue: string;
  scheduledAt: Date;
  matchUrl: string;
  kind: "created" | "reminder-96h" | "reminder-48h";
}): RenderedEmail {
  const when = formatMatchDateTime(input.scheduledAt);
  const urgencyVi =
    input.kind === "reminder-96h"
      ? "<p><strong>Còn 4 ngày nữa!</strong></p>"
      : input.kind === "reminder-48h"
        ? "<p><strong>Còn 2 ngày nữa!</strong></p>"
        : "";
  const urgencyEn =
    input.kind === "reminder-96h"
      ? "<p><strong>4 days left!</strong></p>"
      : input.kind === "reminder-48h"
        ? "<p><strong>2 days left!</strong></p>"
        : "";
  const headingVi = input.kind === "created" ? "Trận cầu lông mới" : "Nhắc đăng ký trận";
  const headingEn =
    input.kind === "created" ? "New badminton session" : "Match registration reminder";

  return renderBilingualEmail({
    subject:
      input.kind === "created"
        ? `[Bestminton] Trận mới / New match: ${input.title}`
        : `[Bestminton] Nhắc trận / Reminder: ${input.title}`,
    bodyVi: `
      <p>Xin chào ${input.recipientName},</p>
      ${urgencyVi}
      <p><strong>${headingVi}</strong></p>
      <ul>
        <li>${input.title}</li>
        <li>${input.venue}</li>
        <li>${when.vi}</li>
      </ul>
      <p><a href="${input.matchUrl}">Đăng ký ngay</a></p>
    `,
    bodyEn: `
      <p>Hi ${input.recipientName},</p>
      ${urgencyEn}
      <p><strong>${headingEn}</strong></p>
      <ul>
        <li>${input.title}</li>
        <li>${input.venue}</li>
        <li>${when.en}</li>
      </ul>
      <p><a href="${input.matchUrl}">Register now</a></p>
    `,
  });
}
