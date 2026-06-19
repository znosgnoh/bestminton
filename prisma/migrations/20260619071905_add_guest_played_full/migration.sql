-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Guest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT,
    "registrationId" INTEGER NOT NULL,
    "playedFull" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Guest_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "MatchRegistration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Guest" ("id", "label", "registrationId") SELECT "id", "label", "registrationId" FROM "Guest";
DROP TABLE "Guest";
ALTER TABLE "new_Guest" RENAME TO "Guest";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
