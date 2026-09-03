import type { Locale } from "@/lib/i18n";

/**
 * Fixed team timezone for scheduling inputs, emails, and server calendar logic.
 * UI display should use {@link formatLocal} (viewer browser timezone) instead.
 */
export const SCHEDULE_TIMEZONE = "Asia/Singapore";
export const SCHEDULE_UTC_OFFSET = "+08:00";

/** @deprecated Use SCHEDULE_TIMEZONE */
export const APP_TIMEZONE = SCHEDULE_TIMEZONE;

export function intlLocale(locale: Locale): string {
  if (locale === "zh") return "zh-CN";
  if (locale === "vi") return "vi-VN";
  return "en-SG";
}

function asDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

function resolveLocale(locale: Locale | string): string {
  return locale === "en" || locale === "vi" || locale === "zh"
    ? intlLocale(locale)
    : locale;
}

/** Format a timestamp in the viewer's local timezone (UI display). */
export function formatLocal(
  value: Date | string,
  locale: Locale | string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(resolveLocale(locale), options).format(asDate(value));
}

/** Format a timestamp in Asia/Singapore (emails, schedule labels, server copy). */
export function formatSingapore(
  value: Date | string,
  locale: Locale | string,
  options: Intl.DateTimeFormatOptions
): string {
  return new Intl.DateTimeFormat(resolveLocale(locale), {
    timeZone: SCHEDULE_TIMEZONE,
    ...options,
  }).format(asDate(value));
}

/** @deprecated Use formatSingapore */
export const formatInAppTz = formatSingapore;

/** Calendar day key `YYYY-MM-DD` in the viewer's local timezone. */
export function localDayKey(value: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asDate(value));
}

/** Calendar day key `YYYY-MM-DD` in Asia/Singapore. */
export function singaporeDayKey(value: Date | string = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: SCHEDULE_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(asDate(value));
}

/** @deprecated Use singaporeDayKey */
export const appDayKey = singaporeDayKey;

/** Weekday 0=Sun … 6=Sat in Asia/Singapore. */
export function getSingaporeWeekday(value: Date | string): number {
  const label = formatSingapore(value, "en-US", { weekday: "short" });
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[label] ?? 0;
}

/** @deprecated Use getSingaporeWeekday */
export const getAppWeekday = getSingaporeWeekday;

/** `<input type="date">` value for an ISO timestamp in Singapore (match scheduling). */
export function toSingaporeInputDate(iso: string): string {
  return singaporeDayKey(iso);
}

/** `<input type="time">` value (`HH:mm`) for an ISO timestamp in Singapore. */
export function toSingaporeInputTime(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: SCHEDULE_TIMEZONE,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(asDate(iso));
  const hour = parts.find((p) => p.type === "hour")?.value ?? "00";
  const minute = parts.find((p) => p.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

/** @deprecated Use toSingaporeInputDate */
export const toAppInputDate = toSingaporeInputDate;
/** @deprecated Use toSingaporeInputTime */
export const toAppInputTime = toSingaporeInputTime;

/**
 * Interpret a Singapore wall-clock date+time as UTC ISO.
 * `dateYmd` = `YYYY-MM-DD`, `timeHm` = `HH:mm` or `HH:mm:ss`.
 */
export function singaporeLocalToIso(dateYmd: string, timeHm: string): string {
  const time = timeHm.length === 5 ? `${timeHm}:00` : timeHm;
  return new Date(`${dateYmd}T${time}${SCHEDULE_UTC_OFFSET}`).toISOString();
}
