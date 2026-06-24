-- AlterTable
ALTER TABLE "Member" ALTER COLUMN "eloRating" SET DEFAULT 1000;

-- Align existing members with the new default
UPDATE "Member" SET "eloRating" = 1000;
