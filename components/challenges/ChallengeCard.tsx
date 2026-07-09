"use client";

import Link from "next/link";
import { Play } from "lucide-react";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import StatusBadge from "@/components/ui/StatusBadge";
import DrinkChallengeBadge from "@/components/challenges/DrinkChallengeBadge";
import { useI18n } from "@/contexts/LocaleContext";
import { formatDrinkAmount } from "@/lib/constants";
import type { Locale } from "@/lib/i18n";
import type { ChallengeDTO } from "@/lib/types";

interface ChallengeCardProps {
  challenge: ChallengeDTO;
}

function intlLocale(locale: Locale): string {
  if (locale === "zh") return "zh-CN";
  if (locale === "vi") return "vi-VN";
  return "en-US";
}

function formatPlayers(challenge: ChallengeDTO): string {
  const sideA = challenge.sideA.players.map((p) => p.name).join(" & ");
  const sideB = challenge.sideB.players.map((p) => p.name).join(" & ");
  return `${sideA} vs ${sideB}`;
}

function formatDate(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(intlLocale(locale), {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function ChallengeCard({ challenge }: ChallengeCardProps) {
  const { locale, t } = useI18n();
  const totalPool = challenge.sideA.poolTokens + challenge.sideB.poolTokens;
  const isCompleted = challenge.status === "COMPLETED";
  const displayDate = isCompleted && challenge.completedAt ? challenge.completedAt : challenge.createdAt;
  const handicapPoints =
    isCompleted && challenge.confirmedHandicapPoints != null
      ? challenge.confirmedHandicapPoints
      : challenge.handicapPoints;

  return (
    <Link href={`/challenges/${challenge.id}`} className="tet-card-hover block p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {formatPlayers(challenge)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {challenge.format === "DOUBLES" ? t("challenges.doublesShort") : t("challenges.singlesShort")} ·{" "}
            {formatDate(displayDate, locale)}
          </p>
        </div>
        <StatusBadge status={challenge.status} />
      </div>
      {challenge.youtubeUrl && (
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-400">
          <Play size={12} />
          {t("common.youtubeVideo")}
        </p>
      )}
      {challenge.isDrinkChallenge && !isCompleted && (
        <div className="mt-2">
          <DrinkChallengeBadge />
        </div>
      )}
      {!isCompleted && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 inline-flex items-center gap-1 flex-wrap">
          <OrangeJuiceIcon size={12} className="text-orange-500 dark:text-orange-400 shrink-0" />
          Pool: {formatDrinkAmount(totalPool)}
          {challenge.handicapPoints > 0 && (
            <span className="ml-1">
              ·{" "}
              {t("challenges.handicapFor", {
                points: challenge.handicapPoints,
                side: challenge.handicapRecipientSide,
              })}
              {challenge.format === "DOUBLES" ? t("challenges.handicapDoublesNote") : ""}
            </span>
          )}
        </p>
      )}
      {isCompleted && (
        <div className="mt-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
          {handicapPoints > 0 && (
            <p>
              {t("challenges.handicapFor", {
                points: handicapPoints,
                side: challenge.handicapRecipientSide,
              })}
              {challenge.format === "DOUBLES" ? t("challenges.handicapDoublesNote") : ""}
            </p>
          )}
          {challenge.confirmedScore && (
            <p>{t("challenges.scoreLine", { score: challenge.confirmedScore })}</p>
          )}
          {challenge.winnerSide && (
            <p className="font-medium text-emerald-700 dark:text-amber-400">
              {t("challenges.sideWins", { side: challenge.winnerSide })}
            </p>
          )}
        </div>
      )}
    </Link>
  );
}
