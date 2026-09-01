import type { RenderedEmail } from "../types";
import { renderBilingualEmail } from "./layout";

export function renderChallengeResolvedEmail(input: {
  recipientName: string;
  challengeUrl: string;
  winnerLabel: string;
  score: string;
  handicap: number;
  eloSummary?: string;
  drinkSummary?: string;
}): RenderedEmail {
  const eloVi = input.eloSummary ? `<p>${input.eloSummary}</p>` : "";
  const eloEn = input.eloSummary ? `<p>${input.eloSummary}</p>` : "";
  const drinkVi = input.drinkSummary ? `<p>${input.drinkSummary}</p>` : "";
  const drinkEn = input.drinkSummary ? `<p>${input.drinkSummary}</p>` : "";

  return renderBilingualEmail({
    subject: `[Bestminton] Kèo đã chốt / Kèo resolved`,
    bodyVi: `
      <p>Xin chào ${input.recipientName},</p>
      <p><strong>Kèo đã được chốt.</strong></p>
      <ul>
        <li>Phe thắng: ${input.winnerLabel}</li>
        <li>Tỉ số: ${input.score}</li>
        <li>Chấp: ${input.handicap}</li>
      </ul>
      ${eloVi}
      ${drinkVi}
      <p><a href="${input.challengeUrl}">Xem chi tiết</a></p>
    `,
    bodyEn: `
      <p>Hi ${input.recipientName},</p>
      <p><strong>The kèo has been resolved.</strong></p>
      <ul>
        <li>Winner: ${input.winnerLabel}</li>
        <li>Score: ${input.score}</li>
        <li>Handicap: ${input.handicap}</li>
      </ul>
      ${eloEn}
      ${drinkEn}
      <p><a href="${input.challengeUrl}">View details</a></p>
    `,
  });
}
