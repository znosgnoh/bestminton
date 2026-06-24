import StatusBadge from "@/components/ui/StatusBadge";
import Avatar from "@/components/ui/Avatar";
import DrinkChallengeBadge from "@/components/challenges/DrinkChallengeBadge";
import type { ChallengeDTO } from "@/lib/types";

interface ChallengeMatchInfoProps {
  challenge: ChallengeDTO;
}

function formatPct(prob: number): string {
  return `${Math.round(prob * 100)}%`;
}

export default function ChallengeMatchInfo({ challenge }: ChallengeMatchInfoProps) {
  const { sideA, sideB, handicapPoints, handicapRecipientSide } = challenge;

  return (
    <div className="tet-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="tet-section-title">
          {challenge.format === "DOUBLES" ? "Kèo đôi" : "Kèo đơn"}
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          {challenge.isDrinkChallenge && <DrinkChallengeBadge />}
          <StatusBadge status={challenge.status} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <SideBlock label="Side A" side={sideA} isDoubles={challenge.format === "DOUBLES"} />
        <span className="text-lg font-bold text-gray-400 dark:text-gray-500">vs</span>
        <SideBlock label="Side B" side={sideB} isDoubles={challenge.format === "DOUBLES"} align="right" />
      </div>

      <div className="grid grid-cols-2 gap-3 text-center text-sm">
        <div className="rounded-xl bg-amber-50/80 dark:bg-gray-800/80 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Win chance</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-amber-400">{formatPct(sideA.winProbability)}</p>
        </div>
        <div className="rounded-xl bg-amber-50/80 dark:bg-gray-800/80 p-3">
          <p className="text-xs text-gray-500 dark:text-gray-400">Win chance</p>
          <p className="text-lg font-bold text-emerald-700 dark:text-amber-400">{formatPct(sideB.winProbability)}</p>
        </div>
      </div>

      {challenge.status !== "PENDING" && handicapPoints > 0 && (
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Chấp điểm: <strong>{handicapPoints}</strong> điểm cho Side {handicapRecipientSide}
          {challenge.format === "DOUBLES" && " (Elo trung bình thấp hơn)"}
        </p>
      )}
    </div>
  );
}

function SideBlock({
  label,
  side,
  isDoubles,
  align = "left",
}: {
  label: string;
  side: ChallengeDTO["sideA"];
  isDoubles: boolean;
  align?: "left" | "right";
}) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
        {label}
        {isDoubles && ` · avg ${Math.round(side.averageElo)}`}
      </p>
      <div className={`flex flex-col gap-2 ${align === "right" ? "items-end" : "items-start"}`}>
        {side.players.map((p) => (
          <div key={p.id} className="flex items-center gap-2">
            {align === "right" && (
              <div className="text-right">
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                <p className="text-xs text-gray-500">{p.eloRating} Elo</p>
              </div>
            )}
            <Avatar name={p.name} avatarUrl={p.avatarUrl} size="md" />
            {align === "left" && (
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{p.name}</p>
                <p className="text-xs text-gray-500">{p.eloRating} Elo</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
