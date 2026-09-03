import type { ChallengeDTO } from "@/lib/types";
import type { Locale } from "@/lib/i18n";
import { formatLocal, localDayKey } from "@/lib/datetime";

export interface ChallengeDayGroup {
  key: string;
  date: Date;
  items: ChallengeDTO[];
}

function challengeSortTime(c: ChallengeDTO): number {
  return new Date(c.completedAt ?? c.createdAt).getTime();
}

export function groupChallengesByDay(challenges: ChallengeDTO[]): ChallengeDayGroup[] {
  const map = new Map<string, ChallengeDTO[]>();

  for (const challenge of challenges) {
    const key = localDayKey(challenge.completedAt ?? challenge.createdAt);
    const bucket = map.get(key);
    if (bucket) bucket.push(challenge);
    else map.set(key, [challenge]);
  }

  return Array.from(map.entries())
    .map(([key, items]) => ({
      key,
      // Local noon keeps the calendar day stable when formatting labels.
      date: new Date(`${key}T12:00:00`),
      items: items.sort((a, b) => challengeSortTime(b) - challengeSortTime(a)),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function formatChallengeDayLabel(
  date: Date,
  locale: Locale,
  t: (key: "challenges.today" | "challenges.yesterday", params?: Record<string, string | number>) => string
): string {
  const todayKey = localDayKey();
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const dateKey = localDayKey(date);

  if (dateKey === todayKey) return t("challenges.today");
  if (dateKey === localDayKey(yesterday)) return t("challenges.yesterday");

  return formatLocal(date, locale, {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: localDayKey(date).slice(0, 4) !== todayKey.slice(0, 4) ? "numeric" : undefined,
  });
}
