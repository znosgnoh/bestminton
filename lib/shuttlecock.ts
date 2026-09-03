import { formatSingapore } from "./datetime";

/** Default shuttlecock fee per hour of play (SGD). Override with SHUTTLECOCK_FEE_PER_HOUR. */
export const DEFAULT_SHUTTLECOCK_FEE_PER_HOUR = 7.5;

export function getShuttlecockFeePerHour(): number {
  const raw = process.env.SHUTTLECOCK_FEE_PER_HOUR;
  if (raw === undefined || raw === "") return DEFAULT_SHUTTLECOCK_FEE_PER_HOUR;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return DEFAULT_SHUTTLECOCK_FEE_PER_HOUR;
  return n;
}

export interface SettlementFeeSplit {
  ratePerHour: number;
  shuttlecockFee: number;
  courtFee: number;
}

/**
 * Split total settlement into court vs shuttlecock for display.
 * Shuttlecock = rate × hours (capped at totalCost). Court = remainder.
 */
export function splitSettlementFees(
  totalCost: number,
  hours: number,
  ratePerHour: number = getShuttlecockFeePerHour()
): SettlementFeeSplit {
  if (!(totalCost > 0) || !(hours > 0) || !(ratePerHour >= 0)) {
    return { ratePerHour, shuttlecockFee: 0, courtFee: Math.max(0, totalCost) };
  }

  const rawShuttle = Math.round(ratePerHour * hours * 100) / 100;
  const shuttlecockFee = Math.min(rawShuttle, Math.round(totalCost * 100) / 100);
  const courtFee = Math.round((totalCost - shuttlecockFee) * 100) / 100;

  return { ratePerHour, shuttlecockFee, courtFee };
}

/** Prefer exact name match for default shuttlecock recipient. */
export const DEFAULT_SHUTTLECOCK_RECIPIENT_NAME = "Tiến Hoàng";

/** Matches with "single" in the title skip Paid By → recipient shuttlecock remittance logging. */
export function isSingleMatchTitle(title: string): boolean {
  return /\bsingles?\b/i.test(title.trim());
}

/**
 * Whether to create a Splitwise remittance expense (Paid By owes shuttlecock to recipient).
 * Skips single-title matches, zero fees, and when payer is the recipient.
 */
export function shouldCreateShuttlecockRemittance(opts: {
  title: string;
  shuttlecockFee: number;
  paidByMemberId: number | null;
  shuttlecockRecipientMemberId: number | null;
}): boolean {
  if (isSingleMatchTitle(opts.title)) return false;
  if (!(opts.shuttlecockFee > 0)) return false;
  if (!opts.paidByMemberId || !opts.shuttlecockRecipientMemberId) return false;
  if (opts.paidByMemberId === opts.shuttlecockRecipientMemberId) return false;
  return true;
}

export function findMemberIdByShuttlecockDefaultName(
  members: Array<{ id: number; name: string }>
): number | null {
  const target = DEFAULT_SHUTTLECOCK_RECIPIENT_NAME.toLowerCase();
  const exact = members.find((m) => m.name.trim().toLowerCase() === target);
  return exact?.id ?? null;
}

export function findDefaultShuttlecockRecipientId(
  registrations: Array<{ memberId: number; member: { name: string } }>
): number | null {
  return findMemberIdByShuttlecockDefaultName(
    registrations.map((r) => ({ id: r.memberId, name: r.member.name }))
  );
}

/** Splitwise expense description: match title + date. */
export function formatShuttlecockRemittanceDescription(
  title: string,
  scheduledAt: Date | string
): string {
  const dateLabel = formatSingapore(scheduledAt, "en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return `${title} · ${dateLabel}`;
}
