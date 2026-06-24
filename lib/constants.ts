/** Fixed stake per bet in v1 (1 ly nước cam). */
export const DEFAULT_BET_AMOUNT = 1;

/** User-facing label for the betting currency (orange juice). */
export const DRINK_LABEL = "Nước cam";
export const DRINK_CHALLENGE_LABEL = "Kèo nước cam";
export const DRINK_LABEL_SHORT = "";

/** e.g. "3 ly nước cam" */
export function formatDrinkAmount(count: number): string {
  return `${count} ly ${DRINK_LABEL.toLowerCase()}`;
}

/** Compact form for tight UI, e.g. "0 cam" */
export function formatDrinkAmountShort(count: number): string {
  return `${count} ${DRINK_LABEL_SHORT}`;
}

/** Signed net cam, e.g. "+2 cam" or "-1 cam" */
export function formatDrinkPayout(payout: number): string {
  const prefix = payout > 0 ? "+" : payout < 0 ? "-" : "";
  return `${prefix}${formatDrinkAmountShort(Math.abs(payout))}`;
}
