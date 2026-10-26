import { fromCents, toCents } from "./ledgerMath";
import type { LedgerExpenseDTO, LedgerExpenseKind } from "./types";

export interface PairBreakdownItem {
  expenseId: number;
  kind: LedgerExpenseKind;
  matchId: number | null;
  title: string;
  createdAt: string;
  /** Positive = debtor→creditor remainder; negative = offsetting remittance the other way. */
  remainder: number;
}

export function shareRemainder(owed: number, paid: number): number {
  return fromCents(toCents(owed) - toCents(paid));
}

/** Direct remainders in one direction only (mark-paid FIFO). */
export function pairBreakdownItems(
  expenses: LedgerExpenseDTO[],
  debtorId: number,
  creditorId: number
): PairBreakdownItem[] {
  const items: PairBreakdownItem[] = [];
  for (const expense of expenses) {
    if (expense.paidByMemberId !== creditorId) continue;
    for (const share of expense.shares) {
      if (share.memberId !== debtorId) continue;
      const remainder = shareRemainder(share.owed, share.paid);
      if (remainder <= 0) continue;
      items.push({
        expenseId: expense.id,
        kind: expense.kind,
        matchId: expense.matchId,
        title: expense.title,
        createdAt: expense.createdAt,
        remainder,
      });
    }
  }
  return items;
}

/**
 * Gross pair lines for display: forward debts (positive) plus reverse remittances
 * (negative). Court/shuttlecock returns that net against match shares stay visible.
 */
export function pairGrossBreakdownItems(
  expenses: LedgerExpenseDTO[],
  debtorId: number,
  creditorId: number
): PairBreakdownItem[] {
  const forward = pairBreakdownItems(expenses, debtorId, creditorId);
  const reverse = pairBreakdownItems(expenses, creditorId, debtorId).map((item) => ({
    ...item,
    remainder: -item.remainder,
  }));
  return [...forward, ...reverse].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.expenseId - b.expenseId
  );
}

export function pairDirectRemainder(
  expenses: LedgerExpenseDTO[],
  debtorId: number,
  creditorId: number
): number {
  return fromCents(
    pairBreakdownItems(expenses, debtorId, creditorId).reduce(
      (sum, item) => sum + toCents(item.remainder),
      0
    )
  );
}

/** Open remittance rows where `memberId` is the creditor (money returning to them). */
export function openRemittancesToMember(
  expenses: LedgerExpenseDTO[],
  memberId: number
): Array<{
  expense: LedgerExpenseDTO;
  debtorId: number;
  debtorName: string;
  remainder: number;
}> {
  const rows: Array<{
    expense: LedgerExpenseDTO;
    debtorId: number;
    debtorName: string;
    remainder: number;
  }> = [];
  for (const expense of expenses) {
    if (expense.kind !== "COURT" && expense.kind !== "SHUTTLECOCK") continue;
    if (expense.paidByMemberId !== memberId) continue;
    for (const share of expense.shares) {
      const remainder = shareRemainder(share.owed, share.paid);
      if (remainder <= 0) continue;
      rows.push({
        expense,
        debtorId: share.memberId,
        debtorName: share.memberName,
        remainder,
      });
    }
  }
  return rows.sort(
    (a, b) =>
      b.expense.createdAt.localeCompare(a.expense.createdAt) || b.expense.id - a.expense.id
  );
}
