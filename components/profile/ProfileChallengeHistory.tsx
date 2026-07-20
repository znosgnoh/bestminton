"use client";

import ChallengeCard from "@/components/challenges/ChallengeCard";
import { useI18n } from "@/contexts/LocaleContext";
import type { ChallengeDTO } from "@/lib/types";

interface ProfileChallengeHistoryProps {
  challenges: ChallengeDTO[];
}

export default function ProfileChallengeHistory({ challenges }: ProfileChallengeHistoryProps) {
  const { t } = useI18n();

  if (challenges.length === 0) {
    return (
      <div className="tet-empty py-6">
        <p>{t("profile.noChallenges")}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {challenges.map((challenge) => (
        <li key={challenge.id}>
          <ChallengeCard challenge={challenge} />
        </li>
      ))}
    </ul>
  );
}
