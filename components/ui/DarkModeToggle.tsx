"use client";

import { useLayoutEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";
import {
  applyThemeClass,
  persistTheme,
  THEME_STORAGE_KEY,
  type Theme,
} from "@/lib/theme";

function readPreferredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "dark" || stored === "light") return stored;
  } catch {
    // ignore
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches) {
    return "dark";
  }
  return "light";
}

export default function DarkModeToggle() {
  const { t } = useI18n();
  const [theme, setTheme] = useState<Theme>("light");
  const [mounted, setMounted] = useState(false);

  // Re-apply after hydration — React resets <html className> to the SSR value
  // and can wipe a `dark` class that the blocking script added.
  useLayoutEffect(() => {
    const preferred = readPreferredTheme();
    applyThemeClass(preferred);
    persistTheme(preferred);
    setTheme(preferred);
    setMounted(true);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyThemeClass(next);
    persistTheme(next);
  }

  if (!mounted) return <div className="h-9 w-9" aria-hidden />;

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? t("theme.light") : t("theme.dark")}
      className="tet-btn-icon flex h-9 w-9 items-center justify-center hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:focus-visible:outline-amber-500"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
