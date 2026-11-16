/**
 * Singapore PayNow (SGQR / EMVCo) helpers.
 * Generates merchant-presented payloads for personal mobile proxies.
 */

const SG_MOBILE_LOCAL = /^[89]\d{7}$/;

export function normalizePaynowMobile(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const digits = raw.replace(/[\s()-]/g, "");
  if (!digits) return null;

  let local: string | null = null;
  if (digits.startsWith("+65") && digits.length === 11) {
    local = digits.slice(3);
  } else if (digits.startsWith("65") && digits.length === 10) {
    local = digits.slice(2);
  } else if (/^\d{8}$/.test(digits)) {
    local = digits;
  } else {
    return null;
  }

  if (!SG_MOBILE_LOCAL.test(local)) return null;
  return `+65${local}`;
}

/** Display form without +65, e.g. 9123 4567 */
export function formatPaynowMobileDisplay(normalized: string): string {
  const local = normalized.replace(/^\+65/, "");
  if (local.length === 8) return `${local.slice(0, 4)} ${local.slice(4)}`;
  return normalized;
}

function tlv(id: string, value: string): string {
  if (id.length !== 2) throw new Error(`Invalid TLV id: ${id}`);
  if (value.length > 99) throw new Error(`TLV value too long for id ${id}`);
  return `${id}${String(value.length).padStart(2, "0")}${value}`;
}

/** CRC-16/CCITT-FALSE (poly 0x1021, init 0xFFFF) — EMV QR requirement. */
export function crc16CcittFalse(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xffff;
      else crc = (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface PayNowQrOptions {
  /** Normalized +65XXXXXXXX mobile */
  mobile: string;
  /** SGD amount; omit for static QR */
  amount?: number;
  /** Merchant / recipient display name (max 25) */
  merchantName?: string;
  /** Bill / reference (max 25) — Additional Data Field 62 → 01 */
  reference?: string;
  /** When false (default) and amount set, banks lock the amount */
  amountEditable?: boolean;
  /** Expiry as YYYYMMDD or YYYYMMDDHHmmss; default +7 calendar days YYYYMMDD */
  expiry?: string;
}

function truncate(value: string, max: number): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  return trimmed.length <= max ? trimmed : trimmed.slice(0, max);
}

function defaultExpiryYmd(now = new Date()): string {
  const d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

/**
 * Build a PayNow SGQR payload string for a personal mobile number.
 * Returns null if mobile is invalid.
 */
export function buildPayNowPayload(options: PayNowQrOptions): string | null {
  const mobile = normalizePaynowMobile(options.mobile);
  if (!mobile) return null;

  const hasAmount =
    options.amount !== undefined &&
    Number.isFinite(options.amount) &&
    options.amount > 0;

  const amountEditable = options.amountEditable === true || !hasAmount;
  const expiry = options.expiry?.trim() || defaultExpiryYmd();

  const merchantAccount = [
    tlv("00", "SG.PAYNOW"),
    tlv("01", "0"), // mobile proxy
    tlv("02", mobile),
    tlv("03", amountEditable ? "1" : "0"),
    tlv("04", expiry),
  ].join("");

  const merchantName = truncate(options.merchantName ?? "", 25) || "NA";
  const reference = truncate(options.reference ?? "", 25);

  const parts = [
    tlv("00", "01"),
    tlv("01", hasAmount ? "12" : "11"),
    tlv("26", merchantAccount),
    tlv("52", "0000"),
    tlv("53", "702"),
  ];

  if (hasAmount) {
    parts.push(tlv("54", options.amount!.toFixed(2)));
  }

  parts.push(
    tlv("58", "SG"),
    tlv("59", merchantName),
    tlv("60", "Singapore")
  );

  if (reference) {
    parts.push(tlv("62", tlv("01", reference)));
  }

  const withoutCrc = parts.join("") + "6304";
  return withoutCrc + crc16CcittFalse(withoutCrc);
}

/** Path + query for the in-app PayNow deeplink page. */
export function paynowDeeplinkPath(
  memberId: number,
  opts: { amount?: number; reference?: string; from?: string } = {}
): string {
  const params = new URLSearchParams();
  if (opts.amount !== undefined && Number.isFinite(opts.amount) && opts.amount > 0) {
    params.set("amount", opts.amount.toFixed(2));
  }
  if (opts.reference?.trim()) params.set("ref", truncate(opts.reference, 25));
  if (opts.from?.trim()) params.set("from", truncate(opts.from, 40));
  const qs = params.toString();
  return qs ? `/pay/${memberId}?${qs}` : `/pay/${memberId}`;
}
