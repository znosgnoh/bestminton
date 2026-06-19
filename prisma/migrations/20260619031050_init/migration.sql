-- CreateTable
CREATE TABLE "Member" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "splitwiseId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "Match" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "scheduledAt" DATETIME NOT NULL,
    "hours" REAL,
    "totalCost" REAL,
    "paidByMemberId" INTEGER,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurDayOfWeek" INTEGER,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Match_paidByMemberId_fkey" FOREIGN KEY ("paidByMemberId") REFERENCES "Member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MatchRegistration" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "matchId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "joinedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MatchRegistration_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "MatchRegistration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "label" TEXT,
    "registrationId" INTEGER NOT NULL,
    CONSTRAINT "Guest_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "MatchRegistration" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_splitwiseId_key" ON "Member"("splitwiseId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchRegistration_matchId_memberId_key" ON "MatchRegistration"("matchId", "memberId");
