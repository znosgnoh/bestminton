-- CreateTable
CREATE TABLE "Member" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "avatarUrl" TEXT,
    "splitwiseId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Match" (
    "id" SERIAL NOT NULL,
    "title" TEXT NOT NULL,
    "venue" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "hours" DOUBLE PRECISION,
    "totalCost" DOUBLE PRECISION,
    "paidByMemberId" INTEGER,
    "isRecurring" BOOLEAN NOT NULL DEFAULT false,
    "recurDayOfWeek" INTEGER,
    "synced" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Match_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MatchRegistration" (
    "id" SERIAL NOT NULL,
    "matchId" INTEGER NOT NULL,
    "memberId" INTEGER NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "playedFull" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MatchRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Guest" (
    "id" SERIAL NOT NULL,
    "label" TEXT,
    "registrationId" INTEGER NOT NULL,
    "playedFull" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Guest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_splitwiseId_key" ON "Member"("splitwiseId");

-- CreateIndex
CREATE UNIQUE INDEX "MatchRegistration_matchId_memberId_key" ON "MatchRegistration"("matchId", "memberId");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_paidByMemberId_fkey" FOREIGN KEY ("paidByMemberId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRegistration" ADD CONSTRAINT "MatchRegistration_matchId_fkey" FOREIGN KEY ("matchId") REFERENCES "Match"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MatchRegistration" ADD CONSTRAINT "MatchRegistration_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Guest" ADD CONSTRAINT "Guest_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "MatchRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
