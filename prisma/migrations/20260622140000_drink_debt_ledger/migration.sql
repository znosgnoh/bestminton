-- Drop wallet token balance; replace with pairwise drink debt ledger.

ALTER TABLE "Member" DROP COLUMN "tokenBalance";

-- CreateTable
CREATE TABLE "DrinkDebt" (
    "debtorId" INTEGER NOT NULL,
    "creditorId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DrinkDebt_pkey" PRIMARY KEY ("debtorId","creditorId")
);

-- AlterTable
ALTER TABLE "Bet" ADD COLUMN "counterpartyId" INTEGER;

-- AddForeignKey
ALTER TABLE "DrinkDebt" ADD CONSTRAINT "DrinkDebt_debtorId_fkey" FOREIGN KEY ("debtorId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DrinkDebt" ADD CONSTRAINT "DrinkDebt_creditorId_fkey" FOREIGN KEY ("creditorId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_counterpartyId_fkey" FOREIGN KEY ("counterpartyId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
