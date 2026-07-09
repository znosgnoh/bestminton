"use client";

import ChallengeCard from "@/components/challenges/ChallengeCard";
import { useI18n } from "@/contexts/LocaleContext";
import { formatChallengeDayLabel, groupChallengesByDay } from "@/lib/challengeListUtils";
import type { ChallengeDTO } from "@/lib/types";

interface ChallengeDayGroupsProps {
  challenges: ChallengeDTO[];
}

export default function ChallengeDayGroups({ challenges }: ChallengeDayGroupsProps) {
  const { locale, t } = useI18n();
  const groups = groupChallengesByDay(challenges);

  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <section key={group.key}>
          <h3 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
            {formatChallengeDayLabel(group.date, locale, t)}
          </h3>
          <div className="space-y-3">
            {group.items.map((challenge) => (
              <ChallengeCard key={challenge.id} challenge={challenge} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
