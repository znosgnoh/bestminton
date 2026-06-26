import OrangeJuiceIcon from "@/components/ui/OrangeJuiceIcon";
import { DRINK_LABEL, formatDrinkAmount } from "@/lib/constants";
import type { ChallengeDTO } from "@/lib/types";

interface ChallengeResultSummaryProps {
  challenge: ChallengeDTO;
}

export default function ChallengeResultSummary({ challenge }: ChallengeResultSummaryProps) {
  const resolution = challenge.resolution;
  if (!resolution || challenge.status !== "COMPLETED") return null;

  const matchDebts = (resolution.debts ?? []).filter((d) => d.reason === "match");
  const betDebts = (resolution.debts ?? []).filter((d) => d.reason === "bet");

  return (
    <div className="tet-card p-4 space-y-4">
      <h2 className="tet-section-title text-sm">Results</h2>
      <p className="text-sm text-gray-600 dark:text-gray-400">
        Winner: Side {challenge.winnerSide}
      </p>

      <div>
        {challenge.format === "DOUBLES" ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Kèo đôi không cập nhật Elo.
          </p>
        ) : (
          <>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2">
              Elo Changes
            </h3>
            <div className="divide-y divide-amber-100/60 dark:divide-gray-800">
              {resolution.eloChanges.map((c) => (
                <div key={c.memberId} className="flex items-center justify-between py-2 text-sm">
                  <span className="font-medium text-gray-900 dark:text-gray-100">{c.name}</span>
                  <span className={c.delta >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                    {c.before} → {c.after} ({c.delta >= 0 ? "+" : ""}
                    {c.delta})
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-2 inline-flex items-center gap-1">
          <OrangeJuiceIcon size={12} className="text-orange-500 dark:text-orange-400" />
          {DRINK_LABEL} Debts Recorded
        </h3>

        {(resolution.debts ?? []).length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Kèo này không có nợ nước cam.</p>
        ) : (
          <div className="space-y-3">
            {matchDebts.length > 0 && (
              <div>
                <p className="text-[10px] font-medium uppercase text-gray-400 mb-1">From match</p>
                <div className="divide-y divide-amber-100/60 dark:divide-gray-800">
                  {matchDebts.map((d, i) => (
                    <DebtRow key={`m-${i}`} debt={d} />
                  ))}
                </div>
              </div>
            )}
            {betDebts.length > 0 && (
              <div>
                <p className="text-[10px] font-medium uppercase text-gray-400 mb-1">From bets</p>
                <div className="divide-y divide-amber-100/60 dark:divide-gray-800">
                  {betDebts.map((d, i) => (
                    <DebtRow key={`b-${i}`} debt={d} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function DebtRow({
  debt,
}: {
  debt: { debtorName: string; creditorName: string; amount: number };
}) {
  return (
    <div className="flex items-center justify-between py-2 text-sm gap-2">
      <span className="text-gray-900 dark:text-gray-100 min-w-0 truncate">
        {debt.debtorName} owes {debt.creditorName}
      </span>
      <span className="text-orange-600 dark:text-orange-400 shrink-0 inline-flex items-center gap-1">
        <OrangeJuiceIcon size={12} />
        {formatDrinkAmount(debt.amount)}
      </span>
    </div>
  );
}
