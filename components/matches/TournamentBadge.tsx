"use client";

import { Flame } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";

interface TournamentBadgeProps {
  className?: string;
  size?: "sm" | "md";
}

const SIZE = {
  sm: { icon: 11, text: "text-[10px]", pad: "gap-1 px-2 py-0.5" },
  md: { icon: 13, text: "text-xs", pad: "gap-1.5 px-2.5 py-1" },
};

/** Animated fire pill for tournament matches. */
export default function TournamentBadge({
  className = "",
  size = "sm",
}: TournamentBadgeProps) {
  const { t } = useI18n();
  const s = SIZE[size];

  return (
    <span
      className={`tournament-badge inline-flex shrink-0 items-center rounded-full font-bold uppercase tracking-wide text-orange-50 ring-1 ring-orange-300/70 ${s.pad} ${s.text} ${className}`}
      title={t("matches.tournament")}
      aria-label={t("matches.tournament")}
    >
      <Flame size={s.icon} className="streak-flame-core shrink-0 text-orange-300" aria-hidden />
      <Flame
        size={Math.max(9, s.icon - 2)}
        className="streak-flame-ember -ml-1.5 shrink-0 text-yellow-300"
        aria-hidden
      />
      {t("matches.tournament")}
    </span>
  );
}
