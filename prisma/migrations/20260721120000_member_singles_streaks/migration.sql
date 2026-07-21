-- AlterTable
ALTER TABLE "Member" ADD COLUMN "singlesWinStreak" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Member" ADD COLUMN "singlesLoseStreak" INTEGER NOT NULL DEFAULT 0;

-- One-time backfill from completed singles challenges (oldest first)
DO $$
DECLARE
  r RECORD;
BEGIN
  UPDATE "Member" SET "singlesWinStreak" = 0, "singlesLoseStreak" = 0;

  FOR r IN
    SELECT id, "winnerSide", "playerAId", "playerBId"
    FROM "Challenge"
    WHERE format = 'SINGLES'
      AND status = 'COMPLETED'
      AND "winnerSide" IS NOT NULL
      AND "completedAt" IS NOT NULL
    ORDER BY "completedAt" ASC, id ASC
  LOOP
    IF r."winnerSide" = 'A' THEN
      UPDATE "Member"
      SET "singlesWinStreak" = "singlesWinStreak" + 1, "singlesLoseStreak" = 0
      WHERE id = r."playerAId";
      UPDATE "Member"
      SET "singlesLoseStreak" = "singlesLoseStreak" + 1, "singlesWinStreak" = 0
      WHERE id = r."playerBId";
    ELSE
      UPDATE "Member"
      SET "singlesWinStreak" = "singlesWinStreak" + 1, "singlesLoseStreak" = 0
      WHERE id = r."playerBId";
      UPDATE "Member"
      SET "singlesLoseStreak" = "singlesLoseStreak" + 1, "singlesWinStreak" = 0
      WHERE id = r."playerAId";
    END IF;
  END LOOP;
END $$;
