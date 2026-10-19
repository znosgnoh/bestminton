import { formatCurrency } from "@/lib/currency";
import type { RenderedEmail } from "../types";
import { renderBilingualEmail } from "./layout";

export type DebtReportEdge = {
  debtorId: number;
  debtorName: string;
  creditorId: number;
  creditorName: string;
  amount: number;
};

function formatEdgeLine(
  edge: DebtReportEdge,
  currency: string,
  lang: "vi" | "en"
): string {
  const amount = formatCurrency(edge.amount, currency);
  if (lang === "vi") {
    return `${edge.debtorName} nợ ${edge.creditorName}: <strong>${amount}</strong>`;
  }
  return `${edge.debtorName} owes ${edge.creditorName}: <strong>${amount}</strong>`;
}

function listHtml(lines: string[]): string {
  if (lines.length === 0) return "<p><em>—</em></p>";
  return `<ul>${lines.map((line) => `<li>${line}</li>`).join("")}</ul>`;
}

export function renderMonthlyDebtReminderEmail(input: {
  recipientName: string;
  recipientMemberId: number;
  monthLabel: string;
  currency: string;
  edges: DebtReportEdge[];
  balancesUrl: string;
}): RenderedEmail {
  const youOwe = input.edges.filter((e) => e.debtorId === input.recipientMemberId);
  const owedToYou = input.edges.filter((e) => e.creditorId === input.recipientMemberId);
  const groupLinesVi = input.edges.map((e) => formatEdgeLine(e, input.currency, "vi"));
  const groupLinesEn = input.edges.map((e) => formatEdgeLine(e, input.currency, "en"));
  const youOweVi =
    youOwe.length === 0
      ? "<p>Bạn không nợ ai.</p>"
      : listHtml(youOwe.map((e) => formatEdgeLine(e, input.currency, "vi")));
  const youOweEn =
    youOwe.length === 0
      ? "<p>You do not owe anyone.</p>"
      : listHtml(youOwe.map((e) => formatEdgeLine(e, input.currency, "en")));
  const owedVi =
    owedToYou.length === 0
      ? "<p>Không ai nợ bạn.</p>"
      : listHtml(owedToYou.map((e) => formatEdgeLine(e, input.currency, "vi")));
  const owedEn =
    owedToYou.length === 0
      ? "<p>No one owes you.</p>"
      : listHtml(owedToYou.map((e) => formatEdgeLine(e, input.currency, "en")));

  return renderBilingualEmail({
    subject: `[Bestminton] Nhắc tất toán cuối tháng / Month-end clear debts · ${input.monthLabel}`,
    bodyVi: `
      <p>Xin chào ${input.recipientName},</p>
      <p>Cuối tháng <strong>${input.monthLabel}</strong> — vui lòng tất toán nợ sân (sổ) nếu còn số dư.</p>
      <p><strong>Bạn nợ</strong></p>
      ${youOweVi}
      <p><strong>Người khác nợ bạn</strong></p>
      ${owedVi}
      <p><strong>Báo cáo nhóm</strong></p>
      ${listHtml(groupLinesVi)}
      <p><a href="${input.balancesUrl}">Mở sổ nợ</a></p>
    `,
    bodyEn: `
      <p>Hi ${input.recipientName},</p>
      <p>It is the end of <strong>${input.monthLabel}</strong> — please clear any open court-money balances.</p>
      <p><strong>You owe</strong></p>
      ${youOweEn}
      <p><strong>Owed to you</strong></p>
      ${owedEn}
      <p><strong>Group report</strong></p>
      ${listHtml(groupLinesEn)}
      <p><a href="${input.balancesUrl}">Open balances</a></p>
    `,
  });
}
