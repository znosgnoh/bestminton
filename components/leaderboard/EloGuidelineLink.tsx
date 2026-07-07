"use client";

import Link from "next/link";
import { Info } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";
import { ELO_GUIDELINE_HREF } from "@/lib/eloGuideline";

interface EloGuidelineLinkProps {
  className?: string;
  /** Compact inline text vs pill button */
  variant?: "inline" | "pill";
}

export default function EloGuidelineLink({
  className = "",
  variant = "inline",
}: EloGuidelineLinkProps) {
  const { t } = useI18n();
  const label = t("challenges.eloGuideline");
  if (variant === "pill") {
    return (
      <Link
        href={ELO_GUIDELINE_HREF}
        className={`inline-flex items-center gap-1.5 rounded-full bg-amber-50 dark:bg-amber-950/50 px-3 py-1.5 text-xs font-medium text-amber-800 dark:text-amber-300 ring-1 ring-amber-200/50 dark:ring-amber-800/40 transition-colors hover:bg-amber-100 dark:hover:bg-amber-900/50 ${className}`}
      >
        <Info size={13} />
        {label}
      </Link>
    );
  }

  return (
    <Link href={ELO_GUIDELINE_HREF} className={`tet-link-accent text-sm inline-flex items-center gap-1 ${className}`}>
      <Info size={14} />
      {label}
    </Link>
  );
}
