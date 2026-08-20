-- Splitwise expense IDs have grown past INT4 (e.g. 4640472051).
ALTER TABLE "Expense" ALTER COLUMN "splitwiseExpenseId" SET DATA TYPE BIGINT;
