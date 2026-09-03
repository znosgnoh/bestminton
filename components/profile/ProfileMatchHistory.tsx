"use client";

import Link from "next/link";
import { CheckCircle, MapPin, Users } from "lucide-react";
import { useI18n } from "@/contexts/LocaleContext";
import { formatAmount, getCurrencySymbol } from "@/lib/currency";
import { formatLocal } from "@/lib/datetime";
import type { Locale } from "@/lib/i18n";
import type { MemberMatchHistoryItemDTO } from "@/lib/types";

interface ProfileMatchHistoryProps {
  matches: MemberMatchHistoryItemDTO[];
}

function formatDate(iso: string, locale: Locale): string {
  return formatLocal(iso, locale, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ProfileMatchHistory({ matches }: ProfileMatchHistoryProps) {
  const { locale, t } = useI18n();
  const curSym = getCurrencySymbol();

  if (matches.length === 0) {
    return (
      <div className="tet-empty py-6">
        <p>{t("profile.noMatches")}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {matches.map((match) => (
        <li key={match.matchId}>
          <Link href={`/matches/${match.matchId}`} className="tet-card-hover block p-3">
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 flex-1 font-medium text-gray-900 dark:text-gray-100 truncate">
                {match.title}
              </p>
              {match.synced && (
                <span className="tet-badge-synced shrink-0">
                  <CheckCircle size={10} />
                  {t("common.synced")}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <MapPin size={12} className="shrink-0 text-amber-600 dark:text-amber-400" />
              <span className="truncate whitespace-pre-line">{match.venue}</span>
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
              <span>{formatDate(match.scheduledAt, locale)}</span>
              <span className="inline-flex items-center gap-1">
                <Users size={12} />
                {match.playedFull ? t("common.full") : t("common.halfTime")}
                {match.guestCount > 0 && (
                  <span>
                    · +{match.guestCount} {t("profile.guests")}
                  </span>
                )}
              </span>
            </div>
            {match.totalCost != null && match.paidByName && (
              <div className="mt-2 space-y-0.5 text-xs text-gray-600 dark:text-gray-400">
                <p>{t("profile.paidBy", { name: match.paidByName })}</p>
                {match.courtFee != null && match.shuttlecockFee != null && (
                  <p>
                    {t("profile.courtFee", {
                      amount: `${curSym}${formatAmount(match.courtFee)}`,
                    })}
                    {" · "}
                    {t("profile.shuttlecockFee", {
                      amount: `${curSym}${formatAmount(match.shuttlecockFee)}`,
                    })}
                  </p>
                )}
                {match.shuttlecockRemittance &&
                  match.paidByName &&
                  match.shuttlecockRecipientName &&
                  match.shuttlecockFee != null && (
                    <p className="font-medium text-emerald-700 dark:text-amber-400">
                      {t("profile.remittance", {
                        from: match.paidByName,
                        to: match.shuttlecockRecipientName,
                        amount: `${curSym}${formatAmount(match.shuttlecockFee)}`,
                      })}
                    </p>
                  )}
              </div>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
