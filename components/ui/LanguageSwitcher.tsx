"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";
import { LOCALE_OPTIONS, type Locale } from "@/lib/i18n";

export default function LanguageSwitcher() {
  const { locale, setLocale, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  const current = LOCALE_OPTIONS.find((o) => o.code === locale) ?? LOCALE_OPTIONS[0];

  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  function pick(next: Locale) {
    setLocale(next);
    setOpen(false);
  }

  const localeNames: Record<Locale, string> = {
    vi: t("locale.vi"),
    en: t("locale.en"),
    zh: t("locale.zh"),
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("locale.label")}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="tet-btn-icon flex h-9 items-center gap-1 px-2 hover:bg-amber-50 dark:hover:bg-amber-950/50"
      >
        <span className="text-base leading-none" aria-hidden>
          {current.flag}
        </span>
        <span className="text-xs font-semibold text-gray-600 dark:text-gray-400">{current.label}</span>
        <ChevronDown size={14} className="text-gray-400" />
      </button>

      {open && (
        <>
          <div
            className="fixed inset-0 z-[45] bg-black/25 dark:bg-black/45"
            aria-hidden
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            aria-label={t("locale.label")}
            className="absolute right-0 top-full z-[50] mt-1 min-w-[9rem] overflow-hidden rounded-xl border border-amber-200/60 bg-white py-1 shadow-xl ring-1 ring-amber-200/55 dark:border-gray-700 dark:bg-gray-900 dark:ring-amber-900/35"
          >
          {LOCALE_OPTIONS.map((opt) => (
            <li key={opt.code} role="option" aria-selected={opt.code === locale}>
              <button
                type="button"
                onClick={() => pick(opt.code)}
                className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm transition-colors ${
                  opt.code === locale
                    ? "bg-emerald-50 font-semibold text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300"
                    : "text-gray-700 hover:bg-amber-50 dark:text-gray-300 dark:hover:bg-gray-800"
                }`}
              >
                <span className="text-base leading-none">{opt.flag}</span>
                <span>{opt.label}</span>
                <span className="ml-auto text-xs text-gray-400">{localeNames[opt.code]}</span>
              </button>
            </li>
          ))}
          </ul>
        </>
      )}
    </div>
  );
}
