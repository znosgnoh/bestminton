import type { RenderedEmail } from "../types";
import { renderBilingualEmail } from "./layout";

export function renderLedgerRecordedEmail(input: {
  recipientName: string;
  expenseTitle: string;
  shareAmount: number;
  currency: string;
  paidByName: string;
  balancesUrl: string;
}): RenderedEmail {
  const amount = `${input.shareAmount.toFixed(2)} ${input.currency}`;
  return renderBilingualEmail({
    subject: `[Bestminton] Chi phí mới / New expense: ${input.expenseTitle}`,
    bodyVi: `
      <p>Xin chào ${input.recipientName},</p>
      <p>Chi phí mới đã được ghi nhận: <strong>${input.expenseTitle}</strong></p>
      <p>Phần của bạn: <strong>${amount}</strong></p>
      <p>Người trả: <strong>${input.paidByName}</strong></p>
      <p><a href="${input.balancesUrl}">Xem sổ nợ</a></p>
    `,
    bodyEn: `
      <p>Hi ${input.recipientName},</p>
      <p>A new expense was recorded: <strong>${input.expenseTitle}</strong></p>
      <p>Your share: <strong>${amount}</strong></p>
      <p>Paid by: <strong>${input.paidByName}</strong></p>
      <p><a href="${input.balancesUrl}">View balances</a></p>
    `,
  });
}

export function renderLedgerMarkPaidEmail(input: {
  recipientName: string;
  debtorName: string;
  creditorName: string;
  amount: number;
  currency: string;
  balancesUrl: string;
}): RenderedEmail {
  const amount = `${input.amount.toFixed(2)} ${input.currency}`;
  return renderBilingualEmail({
    subject: `[Bestminton] Đã ghi nhận thanh toán / Payment recorded`,
    bodyVi: `
      <p>Xin chào ${input.recipientName},</p>
      <p><strong>${input.debtorName}</strong> đã ghi nhận thanh toán <strong>${amount}</strong> cho <strong>${input.creditorName}</strong>.</p>
      <p><a href="${input.balancesUrl}">Xem sổ nợ</a></p>
    `,
    bodyEn: `
      <p>Hi ${input.recipientName},</p>
      <p><strong>${input.debtorName}</strong> marked <strong>${amount}</strong> paid to <strong>${input.creditorName}</strong>.</p>
      <p><a href="${input.balancesUrl}">View balances</a></p>
    `,
  });
}
