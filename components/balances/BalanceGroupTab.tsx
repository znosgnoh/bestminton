"use client";

import BalanceEdgeRow from "@/components/balances/BalanceEdgeRow";
import { useI18n } from "@/contexts/LocaleContext";
import type { LedgerEdgeDTO, LedgerSnapshotDTO } from "@/lib/types";

interface BalanceGroupTabProps {
  snapshot: LedgerSnapshotDTO;
  settlingKey: string | null;
  onPaid: (edge: LedgerEdgeDTO) => void;
}

export default function BalanceGroupTab({
  snapshot,
  settlingKey,
  onPaid,
}: BalanceGroupTabProps) {
  const { t } = useI18n();

  if (snapshot.edges.length === 0) {
    return (
      <div className="tet-empty">
        <p className="font-medium">{t("balances.allClear")}</p>
      </div>
    );
  }

  return (
    <ul className="space-y-2" aria-label={t("balances.groupTab")}>
      {snapshot.edges.map((edge) => {
        const key = `${edge.debtorId}:${edge.creditorId}`;
        return (
          <BalanceEdgeRow
            key={key}
            edge={edge}
            expenses={snapshot.expenses}
            currency={snapshot.currency}
            isPaying={settlingKey === key}
            payingDisabled={settlingKey !== null && settlingKey !== key}
            onPaid={onPaid}
          />
        );
      })}
    </ul>
  );
}
