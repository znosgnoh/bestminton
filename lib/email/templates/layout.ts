import type { RenderedEmail } from "../types";
import { SCHEDULE_TIMEZONE } from "@/lib/datetime";

const FOOTER_VI = "Bạn có thể tắt email trong hồ sơ của mình.";
const FOOTER_EN = "You can disable emails on your profile.";

const FONT_SERIF = "Georgia,'Times New Roman',Times,serif";
const FONT_SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif";

const P =
  "margin:0 0 14px;text-align:justify;text-align-last:left;text-justify:inter-word;-webkit-hyphens:auto;hyphens:auto;font-size:15px;line-height:1.7;color:#1f1612";
const UL =
  "margin:4px 0 16px;padding:0 0 0 20px;text-align:left;font-size:15px;line-height:1.7;color:#1f1612";
const LI = "margin:0 0 6px;padding:0;text-align:left";
const A =
  "display:inline-block;margin:6px 0 4px;padding:11px 20px;background:#dc2626;color:#fffbf7;text-decoration:none;border-radius:8px;font-weight:600;font-size:14px;font-family:" +
  FONT_SANS +
  ";letter-spacing:0.01em";

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

/** Inline styles so body copy justifies in clients that ignore inherited text-align. */
function styleBody(html: string): string {
  return html
    .replace(/<p(?:\s[^>]*)?>/gi, `<p style="${P}">`)
    .replace(/<ul(?:\s[^>]*)?>/gi, `<ul style="${UL}">`)
    .replace(/<li(?:\s[^>]*)?>/gi, `<li style="${LI}">`)
    .replace(/<a\s+href=/gi, `<a style="${A}" href=`);
}

function langLabel(label: string): string {
  return `<div style="margin:0 0 12px;font-family:${FONT_SANS};font-size:11px;font-weight:600;letter-spacing:0.14em;text-transform:uppercase;color:#7a6b5e">${label}</div>`;
}

export function renderBilingualEmail(input: {
  subject: string;
  bodyVi: string;
  bodyEn: string;
}): RenderedEmail {
  const html = `<!DOCTYPE html>
<html lang="vi">
<body style="margin:0;padding:0;background:#fff5f0">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fff5f0;padding:28px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#fffbf7;border:1px solid #ead9cc">
          <tr>
            <td style="background:#1f1612;padding:22px 32px">
              <div style="font-family:${FONT_SERIF};font-size:22px;line-height:1.2;letter-spacing:0.04em;color:#fffbf7">Bestminton</div>
              <div style="margin-top:6px;font-family:${FONT_SANS};font-size:11px;letter-spacing:0.16em;text-transform:uppercase;color:#fbbf24">Badminton · Singapore</div>
            </td>
          </tr>
          <tr>
            <td style="height:3px;background:#dc2626;font-size:0;line-height:0">&nbsp;</td>
          </tr>
          <tr>
            <td style="padding:28px 32px 8px;font-family:${FONT_SERIF}">
              ${langLabel("Tiếng Việt")}
              ${styleBody(input.bodyVi)}
            </td>
          </tr>
          <tr>
            <td style="padding:4px 32px 0">
              <hr style="margin:8px 0;border:none;border-top:1px solid #ead9cc" />
            </td>
          </tr>
          <tr>
            <td style="padding:16px 32px 8px;font-family:${FONT_SERIF}">
              ${langLabel("English")}
              ${styleBody(input.bodyEn)}
            </td>
          </tr>
          <tr>
            <td style="padding:12px 32px 28px;font-family:${FONT_SERIF};font-size:12px;line-height:1.65;color:#7a6b5e;text-align:justify;text-align-last:left">
              ${FOOTER_VI}<br />
              ${FOOTER_EN}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const text = `${stripHtml(input.bodyVi)}\n\n---\n\n${stripHtml(input.bodyEn)}\n\n${FOOTER_VI} / ${FOOTER_EN}`;
  return { subject: input.subject, html, text };
}

export function formatMatchDateTime(d: Date): { vi: string; en: string } {
  const opts: Intl.DateTimeFormatOptions = { timeZone: SCHEDULE_TIMEZONE };
  const vi = d.toLocaleString("vi-VN", opts);
  const en = d.toLocaleString("en-SG", opts);
  return { vi, en };
}
