const CURRENCY_SYMBOLS: Record<string, string> = {
  USD: "$",
  SGD: "S$",
  THB: "฿",
  EUR: "€",
  GBP: "£",
  MYR: "RM",
  VND: "₫",
};

export function getCurrencyCode(): string {
  return process.env.SPLITWISE_CURRENCY_CODE ?? "SGD";
}

export function getCurrencySymbol(code?: string): string {
  const c = code ?? getCurrencyCode();
  return CURRENCY_SYMBOLS[c] ?? `${c} `;
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function formatCurrency(amount: number, code?: string): string {
  return `${getCurrencySymbol(code)}${formatAmount(amount)}`;
}

/** Label suffix for form fields, e.g. "Total Court Cost (S$)" */
export function currencyLabel(code?: string): string {
  const c = code ?? getCurrencyCode();
  const sym = getCurrencySymbol(c);
  return sym === c ? c : sym;
}
