"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Flame, Swords, Trophy, Wallet } from "lucide-react";
import BadmintonRacketIcon from "@/components/ui/BadmintonRacketIcon";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import DarkModeToggle from "@/components/ui/DarkModeToggle";
import LanguageSwitcher from "@/components/ui/LanguageSwitcher";
import { useI18n } from "@/contexts/LocaleContext";
import { SITE_SHORT } from "@/app/layout.constants";

type NavIcon = ComponentType<{ size?: number; className?: string }>;

function navActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function AppHeader() {
  const { t } = useI18n();
  const pathname = usePathname() || "/";

  const links: Array<{
    href: string;
    label: string;
    Icon: NavIcon;
    iconClass?: string;
  }> = [
    { href: "/", label: t("nav.matches"), Icon: Trophy },
    { href: "/challenges", label: t("nav.challenges"), Icon: Swords },
    { href: "/leaderboard", label: t("nav.leaderboard"), Icon: Flame },
    {
      href: "/cam",
      label: t("nav.orangeJuice"),
      Icon: OrangeJuiceIcon,
      iconClass: "text-orange-500 dark:text-orange-400",
    },
    { href: "/balances", label: t("nav.balances"), Icon: Wallet },
  ];

  return (
    <header className="tet-header">
      <div className="mx-auto max-w-lg px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          <Link href="/" className="tet-brand min-w-0">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-300 via-amber-400 to-amber-600 p-1.5 shadow-[0_0_14px_rgba(251,191,36,0.45)] ring-1 ring-amber-200/70">
              <BadmintonRacketIcon size={22} variant="logo" className="h-full w-full object-contain" />
            </span>
            <span className="font-heading truncate text-lg font-bold leading-tight tracking-tight dark:text-amber-50">
              {SITE_SHORT}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-0.5">
            <LanguageSwitcher />
            <DarkModeToggle />
          </div>
        </div>
        <nav
          className="tet-nav-scroll mt-2.5 flex items-center gap-3 overflow-x-auto pb-0.5 sm:gap-4"
          aria-label={t("nav.mainNav")}
        >
          {links.map(({ href, label, Icon, iconClass }) => {
            const active = navActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={`tet-nav-link ${active ? "tet-nav-link-active" : ""}`}
                aria-current={active ? "page" : undefined}
              >
                <Icon
                  size={14}
                  className={
                    iconClass ??
                    (active ? "text-emerald-600 dark:text-amber-400" : undefined)
                  }
                  aria-hidden
                />
                <span>{label}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}
