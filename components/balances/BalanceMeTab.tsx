"use client";

import Link from "next/link";
import AvatarTile from "@/components/matches/AvatarTile";
import BalanceEdgeRow from "@/components/balances/BalanceEdgeRow";
import { openRemittancesToMember } from "@/lib/balanceBreakdown";
import { useI18n } from "@/contexts/LocaleContext";
import { formatCurrency } from "@/lib/currency";
import { formatLocal } from "@/lib/datetime";
import type { LedgerEdgeDTO, LedgerSnapshotDTO, MemberDTO } from "@/lib/types";

const EMPTY_DEBT = { totalOwed: 0, totalOwing: 0, netCam: 0 };

function stubMember(id: number, name: string): MemberDTO {
  return {
    id,
    name,
    email: null,
    avatarUrl: null,
    splitwiseId: null,
    eloRating: 1000,
    totalMatches: 0,
    totalWins: 0,
    singlesWinStreak: 0,
    singlesLoseStreak: 0,
    emailNotificationsEnabled: true,
    debtSummary: EMPTY_DEBT,
  };
}

export function pickerMembers(
  members: MemberDTO[],
  snapshot: LedgerSnapshotDTO
): MemberDTO[] {
  const byId = new Map(members.map((m) => [m.id, m]));

  function ensure(id: number, name: string) {
    if (!byId.has(id)) byId.set(id, stubMember(id, name || `Member ${id}`));
  }

  for (const edge of snapshot.edges) {
    ensure(edge.debtorId, edge.debtorName);
    ensure(edge.creditorId, edge.creditorName);
  }
  for (const expense of snapshot.expenses) {
    ensure(expense.paidByMemberId, expense.paidByName);
    for (const share of expense.shares) {
      ensure(share.memberId, share.memberName);
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

interface BalanceMeTabProps {
  snapshot: LedgerSnapshotDTO;
  members: MemberDTO[];
  selectedMemberId: number | null;
  onSelectMember: (id: number) => void;
  settlingKey: string | null;
  onPaid: (edge: LedgerEdgeDTO) => void;
}

export default function BalanceMeTab({
  snapshot,
  members,
  selectedMemberId,
  onSelectMember,
  settlingKey,
  onPaid,
}: BalanceMeTabProps) {
  const { t, locale } = useI18n();
  const people = pickerMembers(members, snapshot);
  const owes = snapshot.edges.filter((e) => e.debtorId === selectedMemberId);
  const owedBy = snapshot.edges.filter((e) => e.creditorId === selectedMemberId);
  const remittances =
    selectedMemberId != null
      ? openRemittancesToMember(snapshot.expenses, selectedMemberId)
      : [];
  const totalOwes = owes.reduce((sum, e) => sum + e.amount, 0);
  const totalOwed = owedBy.reduce((sum, e) => sum + e.amount, 0);
  const selected = people.find((m) => m.id === selectedMemberId) ?? null;

  return (
    <div className="space-y-4">
      <div className="tet-card p-4">
        <h2 className="tet-section-title text-sm mb-3">{t("balances.pickPlayer")}</h2>
        <div className="flex flex-wrap gap-1">
          {people.map((member) => (
            <AvatarTile
              key={member.id}
              member={member}
              registered={member.id === selectedMemberId}
              disabled={false}
              onToggle={() => onSelectMember(member.id)}
            />
          ))}
        </div>
      </div>

      {selected && (
        <>
          <div className="grid grid-cols-2 gap-2">
            <div className="tet-card px-3 py-2.5 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("balances.youOwe")}
              </p>
              <p className="mt-0.5 text-base font-semibold text-orange-600 dark:text-orange-400">
                {formatCurrency(totalOwes, snapshot.currency)}
              </p>
            </div>
            <div className="tet-card px-3 py-2.5 text-center">
              <p className="text-[11px] font-medium uppercase tracking-wide text-gray-500 dark:text-gray-400">
                {t("balances.owedToYou")}
              </p>
              <p className="mt-0.5 text-base font-semibold text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalOwed, snapshot.currency)}
              </p>
            </div>
          </div>

          {owes.length === 0 && owedBy.length === 0 && remittances.length === 0 ? (
            <div className="tet-empty">
              <p className="font-medium">{t("balances.allClear")}</p>
            </div>
          ) : (
            <div className="space-y-4">
              {remittances.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("balances.returnMoney")}
                  </h3>
                  <p className="mb-2 text-xs text-gray-500 dark:text-gray-400">
                    {t("balances.returnMoneyHint")}
                  </p>
                  <ul className="space-y-2" aria-label={t("balances.returnMoney")}>
                    {remittances.map((row) => {
                      const kindLabel =
                        row.expense.kind === "COURT"
                          ? t("balances.court")
                          : t("balances.shuttlecock");
                      const when = formatLocal(row.expense.createdAt, locale, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      });
                      return (
                        <li key={`${row.expense.id}:${row.debtorId}`} className="tet-card p-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              {row.expense.matchId != null ? (
                                <Link
                                  href={`/matches/${row.expense.matchId}`}
                                  className="block truncate text-sm font-medium text-gray-900 dark:text-gray-100 hover:underline underline-offset-2"
                                >
                                  {row.expense.title}
                                </Link>
                              ) : (
                                <p className="truncate text-sm font-medium text-gray-900 dark:text-gray-100">
                                  {row.expense.title}
                                </p>
                              )}
                              <p className="mt-0.5 text-[11px] text-gray-500 dark:text-gray-400">
                                {kindLabel} · {t("balances.remitFrom", { name: row.debtorName })} ·{" "}
                                {when}
                              </p>
                            </div>
                            <span className="shrink-0 text-sm font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                              {formatCurrency(row.remainder, snapshot.currency)}
                            </span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              )}
              {owes.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("balances.youOwe")}
                  </h3>
                  <ul className="space-y-2" aria-label={t("balances.youOwe")}>
                    {owes.map((edge) => {
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
                </section>
              )}
              {owedBy.length > 0 && (
                <section>
                  <h3 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
                    {t("balances.owedToYou")}
                  </h3>
                  <ul className="space-y-2" aria-label={t("balances.owedToYou")}>
                    {owedBy.map((edge) => {
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
                </section>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
