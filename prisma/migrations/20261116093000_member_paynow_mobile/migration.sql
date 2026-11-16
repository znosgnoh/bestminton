-- AlterTable (IF NOT EXISTS: safe if a prior preview partially applied the column)
ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "paynowMobile" TEXT;
