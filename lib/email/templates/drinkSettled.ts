import type { RenderedEmail } from "../types";
import { renderBilingualEmail } from "./layout";

export function renderDrinkSettledEmail(input: {
  recipientName: string;
  debtorName: string;
  creditorName: string;
  amount: number;
}): RenderedEmail {
  return renderBilingualEmail({
    subject: `[Bestminton] Nước cam đã thanh toán / Drink debt settled`,
    bodyVi: `
      <p>Xin chào ${input.recipientName},</p>
      <p><strong>${input.debtorName}</strong> đã thanh toán <strong>${input.amount}</strong> ly nước cam cho <strong>${input.creditorName}</strong>.</p>
    `,
    bodyEn: `
      <p>Hi ${input.recipientName},</p>
      <p><strong>${input.debtorName}</strong> settled <strong>${input.amount}</strong> drink token(s) with <strong>${input.creditorName}</strong>.</p>
    `,
  });
}
