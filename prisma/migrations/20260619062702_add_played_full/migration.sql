-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MatchRegistration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playedFull" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "MatchRegistration_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchRegistration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MatchRegistration" ("id", "joinedAt", "matchId", "memberId") SELECT "id", "joinedAt", "matchId", "memberId" FROM "MatchRegistration";
DROP TABLE "MatchRegistration";
ALTER TABLE "new_MatchRegistration" RENAME TO "MatchRegistration";
CREATE UNIQUE INDEX "MatchRegistration_matchId_memberId_key" ON "MatchRegistration"("matchId", "memberId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
