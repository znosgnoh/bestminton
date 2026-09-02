-- AlterTable
ALTER TABLE "Member" ADD COLUMN "ojBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "DrinkSettleTransaction" (
    "id" SERIAL NOT NULL,
    "fromMemberId" INTEGER NOT NULL,
    "toMemberId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rolledBackAt" TIMESTAMP(3),
    CONSTRAINT "DrinkSettleTransaction_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DrinkSettleTransaction_createdAt_idx" ON "DrinkSettleTransaction"("createdAt");
CREATE INDEX "DrinkSettleTransaction_rolledBackAt_idx" ON "DrinkSettleTransaction"("rolledBackAt");

ALTER TABLE "DrinkSettleTransaction" ADD CONSTRAINT "DrinkSettleTransaction_fromMemberId_fkey"
  FOREIGN KEY ("fromMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DrinkSettleTransaction" ADD CONSTRAINT "DrinkSettleTransaction_toMemberId_fkey"
  FOREIGN KEY ("toMemberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Net migrate from pairwise DrinkDebt (creditor +amount, debtor -amount)
UPDATE "Member" m
SET "ojBalance" = COALESCE((
  SELECT
    COALESCE((SELECT SUM(d."amount") FROM "DrinkDebt" d WHERE d."creditorId" = m."id"), 0)
    - COALESCE((SELECT SUM(d."amount") FROM "DrinkDebt" d WHERE d."debtorId" = m."id"), 0)
), 0);

-- Safety: fail migration if checksum ≠ 0 (Postgres DO block)
DO $$
DECLARE s INTEGER;
BEGIN
  SELECT COALESCE(SUM("ojBalance"), 0) INTO s FROM "Member";
  IF s <> 0 THEN
    RAISE EXCEPTION 'ojBalance checksum % != 0 after DrinkDebt migration', s;
  END IF;
END $$;

DROP TABLE "DrinkDebt";
