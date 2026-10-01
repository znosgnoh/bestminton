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
    | "leaderboard.spotlightInferno"
    | "leaderboard.spotlightOnFire"
    | "leaderboard.spotlightMostActive"
    | "leaderboard.spotlightCamKing"
    | "leaderboard.spotlightSharpest";
  chip: string;
  iconClass: string;
  Icon: SpotlightIcon;
};

const KIND_META: Record<SpotlightKind, SpotlightMeta> = {
  inferno: {
    Icon: Flame,
    labelKey: "leaderboard.spotlightInferno",
    chip: "bg-[#0b1220]/95 ring-2 ring-orange-400/70 text-orange-50 shadow-[0_0_24px_rgba(249,115,22,0.35)]",
    iconClass: "streak-flame-core text-orange-400",
  },
  onFire: {
    Icon: Flame,
    labelKey: "leaderboard.spotlightOnFire",
    chip: "bg-[#0b1220]/95 ring-2 ring-fuchsia-400/60 text-fuchsia-50 shadow-[0_0_22px_rgba(232,121,249,0.28)]",
    iconClass: "streak-flame-core text-fuchsia-300",
  },
  mostActive: {
    Icon: Swords,
    labelKey: "leaderboard.spotlightMostActive",
    chip: "bg-[#0b1220]/95 ring-2 ring-cyan-400/60 text-cyan-50 shadow-[0_0_22px_rgba(34,211,238,0.28)]",
    iconClass: "text-cyan-300",
  },
  camKing: {
    Icon: OrangeJuiceIcon,
    labelKey: "leaderboard.spotlightCamKing",
    chip: "bg-[#0b1220]/95 ring-2 ring-amber-400/65 text-amber-50 shadow-[0_0_22px_rgba(251,191,36,0.3)]",
    iconClass: "text-amber-300",
  },
  sharpest: {
    Icon: Target,
    labelKey: "leaderboard.spotlightSharpest",
    chip: "bg-[#0b1220]/95 ring-2 ring-rose-400/50 text-rose-50 shadow-[0_0_20px_rgba(251,113,133,0.22)]",
    iconClass: "text-rose-300",
  },
};

function formatValue(spotlight: PlayerSpotlight): string {
  if (spotlight.kind === "inferno" || spotlight.kind === "onFire") {
    return `W${spotlight.value}`;
  }
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
      <h2 className="mb-2 font-heading text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-amber-200/70">
        {t("leaderboard.spotlightsTitle")}
      </h2>
      <ul className="flex gap-2.5 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {spotlights.map((spotlight) => {
          const meta = KIND_META[spotlight.kind];
          const Icon = meta.Icon;
          return (
            <li key={spotlight.kind} className="shrink-0">
              <Link
                href={`/members/${spotlight.entry.id}`}
                className={`flex max-w-[12rem] cursor-pointer items-center gap-2.5 rounded-2xl px-3 py-2.5 transition-transform duration-200 hover:-translate-y-0.5 ${meta.chip}`}
              >
                <Avatar
                  name={spotlight.entry.name}
                  avatarUrl={spotlight.entry.avatarUrl}
                  size="sm"
                  className="shrink-0 ring-1 ring-white/20"
                />
                <div className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide opacity-85">
                    <Icon size={11} className={`shrink-0 ${meta.iconClass}`} aria-hidden />
                    <span className="truncate">{t(meta.labelKey)}</span>
                  </p>
                  <p className="truncate text-xs font-semibold text-white">{spotlight.entry.name}</p>
                  <p className="text-[11px] font-bold tabular-nums text-white/80">
                    {formatValue(spotlight)}
                  </p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
