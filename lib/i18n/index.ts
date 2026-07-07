import en from "./messages/en";
import vi from "./messages/vi";
import zh from "./messages/zh";
import type { Locale, LocaleOption, MessageKey, Messages } from "./types";

export type { Locale, LocaleOption, MessageKey, Messages };

export const LOCALE_STORAGE_KEY = "bestminton_locale";

export const LOCALE_OPTIONS: LocaleOption[] = [
  { code: "vi", label: "VN", flag: "🇻🇳", htmlLang: "vi" },
  { code: "en", label: "EN", flag: "🇬🇧", htmlLang: "en" },
  { code: "zh", label: "CN", flag: "🇨🇳", htmlLang: "zh-CN" },
];

const MESSAGE_MAP: Record<Locale, Messages> = { en, vi, zh };

export function isLocale(value: string): value is Locale {
  return value === "vi" || value === "en" || value === "zh";
}

export function getMessages(locale: Locale): Messages {
  return MESSAGE_MAP[locale];
}

export function detectLocale(): Locale {
  if (typeof window === "undefined") return "en";
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (stored && isLocale(stored)) return stored;
  } catch {
    // ignore
  }
  const lang = navigator.language.toLowerCase();
  if (lang.startsWith("vi")) return "vi";
  if (lang.startsWith("zh")) return "zh";
  return "en";
}

function getNestedValue(obj: Record<string, unknown>, path: string): string | undefined {
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const part of parts) {
    if (!cur || typeof cur !== "object" || !(part in cur)) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}

export function createTranslator(locale: Locale) {
  const messages = getMessages(locale) as unknown as Record<string, unknown>;

  return function t(key: MessageKey, params?: Record<string, string | number>): string {
    const template = getNestedValue(messages, key) ?? key;
    if (!params) return template;
    return template.replace(/\{(\w+)\}/g, (_, name: string) =>
      params[name] !== undefined ? String(params[name]) : `{${name}}`
    );
  };
}

export function localeHtmlLang(locale: Locale): string {
  return LOCALE_OPTIONS.find((o) => o.code === locale)?.htmlLang ?? "en";
}
