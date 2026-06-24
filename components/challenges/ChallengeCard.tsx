import Link from "next/link";
import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import StatusBadge from "@/components/ui/StatusBadge";
import DrinkChallengeBadge from "@/components/challenges/DrinkChallengeBadge";
import { formatDrinkAmount } from "@/lib/constants";
import type { ChallengeDTO } from "@/lib/types";

interface ChallengeCardProps {
  challenge: ChallengeDTO;
}

function formatPlayers(challenge: ChallengeDTO): string {
  const sideA = challenge.sideA.players.map((p) => p.name).join(" & ");
  const sideB = challenge.sideB.players.map((p) => p.name).join(" & ");
  return `${sideA} vs ${sideB}`;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

export default function ChallengeCard({ challenge }: ChallengeCardProps) {
  const totalPool = challenge.sideA.poolTokens + challenge.sideB.poolTokens;

  return (
    <Link href={`/challenges/${challenge.id}`} className="tet-card-hover block p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-gray-900 dark:text-gray-100 truncate">
            {formatPlayers(challenge)}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {challenge.format === "DOUBLES" ? "Đôi" : "Đơn"} · {formatDate(challenge.createdAt)}
          </p>
        </div>
        <StatusBadge status={challenge.status} />
      </div>
      {challenge.isDrinkChallenge && challenge.status !== "COMPLETED" && (
        <div className="mt-2">
          <DrinkChallengeBadge />
        </div>
      )}
      {challenge.status !== "COMPLETED" && (
        <p className="mt-2 text-xs text-gray-600 dark:text-gray-400 inline-flex items-center gap-1">
          <OrangeJuiceIcon size={12} className="text-orange-500 dark:text-orange-400" />
          Pool: {formatDrinkAmount(totalPool)}
          {challenge.handicapPoints > 0 && (
            <span className="ml-2">
              · Handicap {challenge.handicapPoints} to Side {challenge.handicapRecipientSide}
            </span>
          )}
        </p>
      )}
    </Link>
  );
}
