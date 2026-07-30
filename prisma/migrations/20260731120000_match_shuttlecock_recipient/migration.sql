-- AlterTable
ALTER TABLE "Match" ADD COLUMN "shuttlecockRecipientMemberId" INTEGER;

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_shuttlecockRecipientMemberId_fkey" FOREIGN KEY ("shuttlecockRecipientMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;
