import type { RegistrationDTO, CalculatedShare } from "./types";

export function calculateShares(
  registrations: RegistrationDTO[],
  totalCost: number,
  hours: number
): CalculatedShare[] {
  if (!registrations.length || totalCost <= 0 || hours <= 0) return [];

  const weighted = registrations.map((r) => {
    const playerFactor = (r.playedFull ?? true) ? 1 : 0.5;
    const guestsFactor = r.guests.reduce(
      (sum, g) => sum + ((g.playedFull ?? true) ? 1 : 0.5),
      0
    );
    return {
      memberId: r.memberId,
      name: r.member.name,
      guestCount: r.guests.length,
      guestsFactor,
      playedFull: r.playedFull ?? true,
      weight: hours * (playerFactor + guestsFactor),
    };
  });

  const totalWeight = weighted.reduce((s, p) => s + p.weight, 0);

  const shares: CalculatedShare[] = weighted.map((p) => ({
    ...p,
    owedShare: Math.round((totalCost * p.weight / totalWeight) * 100) / 100,
  }));

  // Cent-integer rounding correction (prevents Splitwise 422 on mismatch)
  const sumCents = shares.reduce((s, p) => s + Math.round(p.owedShare * 100), 0);
  const diffCents = Math.round(totalCost * 100) - sumCents;
  if (diffCents !== 0) {
    shares[0].owedShare =
      Math.round((shares[0].owedShare + diffCents / 100) * 100) / 100;
  }

  return shares;
}
