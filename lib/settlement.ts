import {
  splitSettlementFees,
  type SettlementFeeSplit,
} from "./shuttlecock";

/** $45 / 12 shuttlecocks */
export const DEFAULT_SHUTTLECOCK_UNIT_PRICE = 3.75;
export const DEFAULT_COURT_FEE_PER_HOUR = 8.375;
export const DEFAULT_COURT_BOOKING_HOURS = 2;

export type CourtBookingInput = {
  memberId: number;
  hours: number;
};

export type SettlementDetails = {
  shuttlecockCount: number;
  shuttlecockUnitPrice: number;
  courtFeePerHour: number;
  bookings: CourtBookingInput[];
};

export type ComputedSettlement = {
  courtHours: number;
  courtFee: number;
  shuttlecockFee: number;
  totalCost: number;
};

export type BookingRemittance = {
  memberId: number;
  hours: number;
  amount: number;
};

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100;
}

function asFiniteNumber(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? n : null;
}

export function computeSettlement(details: SettlementDetails): ComputedSettlement {
  const courtHours = details.bookings.reduce((sum, b) => sum + Math.max(0, b.hours), 0);
  const courtFee = roundMoney(Math.max(0, details.courtFeePerHour) * courtHours);
  const shuttlecockFee = roundMoney(
    Math.max(0, details.shuttlecockCount) * Math.max(0, details.shuttlecockUnitPrice)
  );
  return {
    courtHours,
    courtFee,
    shuttlecockFee,
    totalCost: roundMoney(courtFee + shuttlecockFee),
  };
}

/** Paid By remits each other booker's court fee (same direction as shuttlecock). */
export function bookingRemittances(
  details: SettlementDetails,
  paidByMemberId: number | null
): BookingRemittance[] {
  const hoursByMember = new Map<number, number>();
  for (const b of details.bookings) {
    hoursByMember.set(b.memberId, (hoursByMember.get(b.memberId) ?? 0) + Math.max(0, b.hours));
  }
  const rate = Math.max(0, details.courtFeePerHour);
  const rows: BookingRemittance[] = [];
  for (const [memberId, hours] of hoursByMember) {
    if (paidByMemberId != null && memberId === paidByMemberId) continue;
    const amount = roundMoney(rate * hours);
    if (!(amount > 0)) continue;
    rows.push({ memberId, hours, amount });
  }
  return rows;
}

export function parseSettlementDetails(raw: unknown): SettlementDetails | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const shuttlecockCount = asFiniteNumber(o.shuttlecockCount);
  const shuttlecockUnitPrice = asFiniteNumber(o.shuttlecockUnitPrice);
  const courtFeePerHour = asFiniteNumber(o.courtFeePerHour);
  if (shuttlecockCount == null || shuttlecockCount < 0) return null;
  if (shuttlecockUnitPrice == null || shuttlecockUnitPrice < 0) return null;
  if (courtFeePerHour == null || courtFeePerHour < 0) return null;
  if (!Array.isArray(o.bookings)) return null;

  const bookings: CourtBookingInput[] = [];
  for (const row of o.bookings) {
    if (!row || typeof row !== "object") return null;
    const rec = row as { memberId?: unknown; hours?: unknown };
    const memberId = asFiniteNumber(rec.memberId);
    const hours = asFiniteNumber(rec.hours);
    if (memberId == null || !Number.isInteger(memberId) || memberId <= 0) return null;
    if (hours == null || hours <= 0) return null;
    bookings.push({ memberId, hours });
  }

  return { shuttlecockCount, shuttlecockUnitPrice, courtFeePerHour, bookings };
}

export function resolveFeeSplit(
  match: {
    totalCost: number | null;
    hours: number | null;
    settlementDetails?: unknown;
  },
  fallbackRatePerHour: number
): SettlementFeeSplit | null {
  const details = parseSettlementDetails(match.settlementDetails);
  if (details) {
    const computed = computeSettlement(details);
    if (!(computed.totalCost > 0)) return null;
    return {
      ratePerHour: details.shuttlecockUnitPrice,
      shuttlecockFee: computed.shuttlecockFee,
      courtFee: computed.courtFee,
    };
  }
  if (
    match.totalCost != null &&
    match.totalCost > 0 &&
    match.hours != null &&
    match.hours > 0
  ) {
    return splitSettlementFees(match.totalCost, match.hours, fallbackRatePerHour);
  }
  return null;
}

