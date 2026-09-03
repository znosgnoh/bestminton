import type { RenderedEmail } from "../types";
import { SCHEDULE_TIMEZONE } from "@/lib/datetime";

const FOOTER_VI = "Bạn có thể tắt email trong hồ sơ của mình.";
const FOOTER_EN = "You can disable emails on your profile.";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function renderBilingualEmail(input: {
  subject: string;
  bodyVi: string;
  bodyEn: string;
}): RenderedEmail {
  const html = `
    <div style="font-family:sans-serif;line-height:1.5;color:#111">
      <div>${input.bodyVi}</div>
      <hr style="margin:24px 0;border:none;border-top:1px solid #ddd" />
      <div>${input.bodyEn}</div>
      <p style="margin-top:24px;font-size:12px;color:#666">
        <em>${FOOTER_VI}<br />${FOOTER_EN}</em>
      </p>
    </div>
  `.trim();
  const text = `${stripHtml(input.bodyVi)}\n\n---\n\n${stripHtml(input.bodyEn)}\n\n${FOOTER_VI} / ${FOOTER_EN}`;
  return { subject: input.subject, html, text };
}

export function formatMatchDateTime(d: Date): { vi: string; en: string } {
  const opts: Intl.DateTimeFormatOptions = { timeZone: SCHEDULE_TIMEZONE };
  const vi = d.toLocaleString("vi-VN", opts);
  const en = d.toLocaleString("en-SG", opts);
  return { vi, en };
}
