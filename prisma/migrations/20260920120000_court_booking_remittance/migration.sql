ALTER TYPE "LedgerExpenseKind" ADD VALUE 'COURT';

DROP INDEX "Expense_matchId_kind_key";

CREATE UNIQUE INDEX "Expense_matchId_kind_paidByMemberId_key" ON "Expense"("matchId", "kind", "paidByMemberId");
