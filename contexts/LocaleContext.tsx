"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  LOCALE_STORAGE_KEY,
  createTranslator,
  detectLocale,
  isLocale,
  localeHtmlLang,
  type Locale,
  type MessageKey,
} from "@/lib/i18n";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale = "en",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const [locale, setLocaleState] = useState<Locale>(initialLocale);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const detected = detectLocale();
    if (detected !== initialLocale) setLocaleState(detected);
    setReady(true);
  }, [initialLocale]);

  const setLocale = useCallback((next: Locale) => {
    setLocaleState(next);
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, next);
      document.cookie = `${LOCALE_STORAGE_KEY}=${next};path=/;max-age=31536000;SameSite=Lax`;
    } catch {
      // ignore
    }
    document.documentElement.lang = localeHtmlLang(next);
  }, []);

  useEffect(() => {
    if (!ready) return;
    document.documentElement.lang = localeHtmlLang(locale);
  }, [locale, ready]);

  const t = useMemo(() => createTranslator(locale), [locale]);

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useI18n must be used within LocaleProvider");
  return ctx;
}

export function useI18nOptional(): LocaleContextValue | null {
  return useContext(LocaleContext);
}
