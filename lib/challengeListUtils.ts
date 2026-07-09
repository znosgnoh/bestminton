import type { ChallengeDTO } from "@/lib/types";
import type { Locale } from "@/lib/i18n";

export interface ChallengeDayGroup {
  key: string;
  date: Date;
  items: ChallengeDTO[];
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function challengeSortTime(c: ChallengeDTO): number {
  return new Date(c.completedAt ?? c.createdAt).getTime();
}

export function groupChallengesByDay(challenges: ChallengeDTO[]): ChallengeDayGroup[] {
  const map = new Map<string, ChallengeDTO[]>();

  for (const challenge of challenges) {
    const key = dayKey(challenge.completedAt ?? challenge.createdAt);
    const bucket = map.get(key);
    if (bucket) bucket.push(challenge);
    else map.set(key, [challenge]);
  }

  return Array.from(map.entries())
    .map(([key, items]) => ({
      key,
      date: new Date(`${key}T12:00:00`),
      items: items.sort((a, b) => challengeSortTime(b) - challengeSortTime(a)),
    }))
    .sort((a, b) => b.date.getTime() - a.date.getTime());
}

function intlLocale(locale: Locale): string {
  if (locale === "zh") return "zh-CN";
  if (locale === "vi") return "vi-VN";
  return "en-US";
}

export function formatChallengeDayLabel(
  date: Date,
  locale: Locale,
  t: (key: "challenges.today" | "challenges.yesterday", params?: Record<string, string | number>) => string
): string {
  const now = new Date();
  const todayKey = dayKey(now.toISOString());
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const dateKey = dayKey(date.toISOString());

  if (dateKey === todayKey) return t("challenges.today");
  if (dateKey === dayKey(yesterday.toISOString())) return t("challenges.yesterday");

  return new Intl.DateTimeFormat(intlLocale(locale), {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
  }).format(date);
}
