"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { Flame, Swords, Target } from "lucide-react";
import Avatar from "@/components/ui/Avatar";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { useI18n } from "@/contexts/LocaleContext";
import {
  pickPlayerSpotlights,
  type PlayerSpotlight,
  type SpotlightKind,
} from "@/lib/leaderboardHighlights";
import type { LeaderboardEntryDTO } from "@/lib/types";

interface PlayerSpotlightsProps {
  entries: LeaderboardEntryDTO[];
}

type SpotlightIcon = ComponentType<{ size?: number; className?: string }>;

type SpotlightMeta = {
  labelKey:
    | "leaderboard.spotlightOnFire"
    | "leaderboard.spotlightMostActive"
    | "leaderboard.spotlightCamKing"
    | "leaderboard.spotlightSharpest";
  chip: string;
  iconClass: string;
  Icon: SpotlightIcon;
};

const KIND_META: Record<SpotlightKind, SpotlightMeta> = {
  onFire: {
    Icon: Flame,
    labelKey: "leaderboard.spotlightOnFire",
    chip: "bg-slate-950/95 ring-orange-400/40 text-orange-100 shadow-[0_0_20px_rgba(251,146,60,0.12)]",
    iconClass: "text-orange-400",
  },
  mostActive: {
    Icon: Swords,
    labelKey: "leaderboard.spotlightMostActive",
    chip: "bg-slate-950/95 ring-cyan-400/35 text-cyan-50 shadow-[0_0_20px_rgba(34,211,238,0.1)]",
    iconClass: "text-cyan-300",
  },
  camKing: {
    Icon: OrangeJuiceIcon,
    labelKey: "leaderboard.spotlightCamKing",
    chip: "bg-slate-950/95 ring-amber-400/35 text-amber-50 shadow-[0_0_20px_rgba(251,191,36,0.1)]",
    iconClass: "text-amber-300",
  },
  sharpest: {
    Icon: Target,
    labelKey: "leaderboard.spotlightSharpest",
    chip: "bg-slate-950/95 ring-fuchsia-400/35 text-fuchsia-50 shadow-[0_0_20px_rgba(232,121,249,0.1)]",
    iconClass: "text-fuchsia-300",
  },
};

function formatValue(spotlight: PlayerSpotlight): string {
  if (spotlight.kind === "onFire") return `×${spotlight.value}`;
  if (spotlight.kind === "mostActive") return String(spotlight.value);
  if (spotlight.kind === "camKing") return `+${spotlight.value}`;
  return `${Math.round(spotlight.value * 100)}%`;
}

export default function PlayerSpotlights({ entries }: PlayerSpotlightsProps) {
  const { t } = useI18n();
  const spotlights = pickPlayerSpotlights(entries);
  if (spotlights.length === 0) return null;

  return (
    <section aria-label={t("leaderboard.spotlightsTitle")}>
      <h2 className="mb-2 font-heading text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {t("leaderboard.spotlightsTitle")}
      </h2>
      <ul className="flex gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {spotlights.map((spotlight) => {
          const meta = KIND_META[spotlight.kind];
          const Icon = meta.Icon;
          return (
            <li key={spotlight.kind} className="shrink-0">
              <Link
                href={`/members/${spotlight.entry.id}`}
                className={`flex max-w-[11.5rem] cursor-pointer items-center gap-2 rounded-xl px-2.5 py-2 ring-1 transition-transform duration-200 hover:-translate-y-0.5 ${meta.chip}`}
              >
                <Avatar
                  name={spotlight.entry.name}
                  avatarUrl={spotlight.entry.avatarUrl}
                  size="sm"
                  className="shrink-0 ring-1 ring-white/15"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-80">
                    <Icon size={11} className={`shrink-0 ${meta.iconClass}`} aria-hidden />
                    <span className="truncate">{t(meta.labelKey)}</span>
                  </p>
                  <p className="truncate text-xs font-semibold text-white">{spotlight.entry.name}</p>
                  <p className="text-[10px] tabular-nums opacity-70">{formatValue(spotlight)}</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
