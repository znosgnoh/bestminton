import Link from "next/link";
import StatusBadge from "@/components/ui/StatusBadge";
import Avatar from "@/components/ui/Avatar";
import DrinkChallengeBadge from "@/components/challenges/DrinkChallengeBadge";
import type { ChallengeDTO, ChallengePlayerDTO } from "@/lib/types";

interface ChallengeMatchInfoProps {
  challenge: ChallengeDTO;
}

function formatPlayerRecord(player: ChallengePlayerDTO): string {
  const losses = player.totalMatches - player.totalWins;
  const winPct = Math.round(player.winRate * 100);
  return `${player.totalWins}–${losses} · ${winPct}%`;
}

export default function ChallengeMatchInfo({ challenge }: ChallengeMatchInfoProps) {
  const { sideA, sideB, handicapPoints, handicapRecipientSide, pointsToWin } = challenge;

  return (
    <div className="tet-card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h2 className="tet-section-title">
          {challenge.format === "DOUBLES" ? "Kèo đôi" : "Kèo đơn"}
          <span className="ml-2 text-sm font-medium text-gray-500 dark:text-gray-400">
            · {pointsToWin} pts
          </span>
        </h2>
        <div className="flex items-center gap-2 shrink-0">
          {challenge.isDrinkChallenge && <DrinkChallengeBadge />}
          <StatusBadge status={challenge.status} />
        </div>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <SideBlock label="Side A" side={sideA} isDoubles={challenge.format === "DOUBLES"} />
        <span className="text-lg font-bold text-gray-400 dark:text-gray-500">vs</span>
        <SideBlock
          label="Side B"
          side={sideB}
          isDoubles={challenge.format === "DOUBLES"}
          align="right"
        />
      </div>

      {handicapPoints > 0 && (
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Chấp điểm: <strong>{handicapPoints}</strong> điểm cho Side {handicapRecipientSide}
          {challenge.format === "DOUBLES" && " (Elo trung bình thấp hơn)"}
        </p>
      )}

      {challenge.status === "COMPLETED" && challenge.confirmedScore && (
        <p className="text-center text-sm text-gray-600 dark:text-gray-400">
          Tỷ số: <strong>{challenge.confirmedScore}</strong>
          {challenge.winnerSide && (
            <>
              {" "}
              · Side <strong>{challenge.winnerSide}</strong> thắng
            </>
          )}
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
                <Link
                  href={`/members/${p.id}`}
                  className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:underline"
                >
                  {p.name}
                </Link>
                <p className="text-xs text-gray-500">{p.eloRating} Elo</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatPlayerRecord(p)}</p>
              </div>
            )}
            <Link href={`/members/${p.id}`}>
              <Avatar name={p.name} avatarUrl={p.avatarUrl} size="md" />
            </Link>
            {align === "left" && (
              <div>
                <Link
                  href={`/members/${p.id}`}
                  className="text-sm font-semibold text-gray-900 dark:text-gray-100 hover:underline"
                >
                  {p.name}
                </Link>
                <p className="text-xs text-gray-500">{p.eloRating} Elo</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{formatPlayerRecord(p)}</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
