-- CreateEnum
CREATE TYPE "LedgerExpenseKind" AS ENUM ('MATCH', 'SHUTTLECOCK', 'OPENING');

-- CreateEnum
CREATE TYPE "LedgerExpenseStatus" AS ENUM ('OPEN', 'SETTLED');

-- CreateTable
CREATE TABLE "Expense" (
    "id" SERIAL NOT NULL,
    "kind" "LedgerExpenseKind" NOT NULL,
    "matchId" INTEGER,
    "title" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "paidByMemberId" INTEGER NOT NULL,
    "status" "LedgerExpenseStatus" NOT NULL DEFAULT 'OPEN',
    "splitwiseExpenseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExpenseShare" (
    "id" SERIAL NOT NULL,
    "expenseId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "owed" DECIMAL(12,2) NOT NULL,
    "paid" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "ExpenseShare_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expense_kind_idx" ON "Expense"("kind");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_matchId_kind_key" ON "Expense"("matchId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "ExpenseShare_expenseId_memberId_key" ON "ExpenseShare"("expenseId", "memberId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_paidByMemberId_fkey" FOREIGN KEY ("paidByMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "Expense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExpenseShare" ADD CONSTRAINT "ExpenseShare_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
