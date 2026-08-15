"use client";

import Link from "next/link";
import BadmintonRacketIcon from "@/components/ui/BadmintonRacketIcon";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import DarkModeToggle from "@/components/ui/DarkModeToggle";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { useI18n } from "@/contexts/LocaleContext";
import { SITE_SHORT } from "@/app/layout.constants";

export default function AppHeader() {
  const { t } = useI18n();

  return (
    <header className="tet-header">
      <div className="mx-auto max-w-lg px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="tet-brand min-w-0">
            <BadmintonRacketIcon size={22} className="shrink-0 text-emerald-600 dark:text-amber-400" />
            <span className="font-heading truncate text-lg font-bold leading-tight tracking-tight">
              {SITE_SHORT}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-0.5">
            <LanguageSwitcher />
            <DarkModeToggle />
          </div>
        </div>
        <nav
          className="tet-nav-scroll mt-2.5 flex items-center gap-3 overflow-x-auto pb-0.5 text-xs font-medium sm:gap-4 sm:text-sm"
          aria-label={t("nav.mainNav")}
        >
          <Link
            href="/"
            className="shrink-0 text-gray-600 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-amber-400"
          >
            {t("nav.matches")}
          </Link>
          <Link
            href="/challenges"
            className="shrink-0 text-gray-600 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-amber-400"
          >
            {t("nav.challenges")}
          </Link>
          <Link
            href="/leaderboard"
            className="shrink-0 text-gray-600 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-amber-400"
          >
            {t("nav.leaderboard")}
          </Link>
          <Link
            href="/cam"
            className="inline-flex shrink-0 items-center gap-1 text-gray-600 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-amber-400"
          >
            <OrangeJuiceIcon size={14} className="text-orange-500 dark:text-orange-400" />
            <span>{t("nav.orangeJuice")}</span>
          </Link>
          <Link
            href="/balances"
            className="shrink-0 text-gray-600 hover:text-emerald-700 dark:text-gray-400 dark:hover:text-amber-400"
          >
            {t("nav.balances")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
