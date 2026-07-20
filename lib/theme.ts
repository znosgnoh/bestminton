export const THEME_STORAGE_KEY = "theme";
export const THEME_COOKIE_KEY = "bestminton_theme";

export type Theme = "light" | "dark";

export function isTheme(value: string | undefined | null): value is Theme {
  return value === "light" || value === "dark";
}

/** Persist theme for both client (localStorage) and SSR (cookie). */
export function persistTheme(theme: Theme) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
    document.cookie = `${THEME_COOKIE_KEY}=${theme};path=/;max-age=31536000;SameSite=Lax`;
  } catch {
    // ignore quota / private mode
  }
}

export function applyThemeClass(theme: Theme) {
  document.documentElement.classList.toggle("dark", theme === "dark");
}
