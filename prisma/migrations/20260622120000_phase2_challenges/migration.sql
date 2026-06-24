-- CreateEnum
CREATE TYPE "ChallengeFormat" AS ENUM ('SINGLES', 'DOUBLES');

-- CreateEnum
CREATE TYPE "ChallengeStatus" AS ENUM ('PENDING', 'ACTIVE', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ChallengeSide" AS ENUM ('A', 'B');

-- AlterTable
ALTER TABLE "Member" ADD COLUMN     "eloRating" INTEGER NOT NULL DEFAULT 1200,
ADD COLUMN     "totalMatches" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "totalWins" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tokenBalance" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "Challenge" (
    "id" SERIAL NOT NULL,
    "format" "ChallengeFormat" NOT NULL DEFAULT 'SINGLES',
    "status" "ChallengeStatus" NOT NULL DEFAULT 'PENDING',
    "playerAId" INTEGER NOT NULL,
    "playerA2Id" INTEGER,
    "playerBId" INTEGER NOT NULL,
    "playerB2Id" INTEGER,
    "handicapPoints" INTEGER NOT NULL DEFAULT 0,
    "winnerSide" "ChallengeSide",
    "winnerId" INTEGER,
    "resolutionSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "Challenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Bet" (
    "id" SERIAL NOT NULL,
    "challengeId" INTEGER NOT NULL,
    "bettorId" INTEGER NOT NULL,
    "side" "ChallengeSide" NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Bet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Bet_challengeId_bettorId_key" ON "Bet"("challengeId", "bettorId");

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_playerAId_fkey" FOREIGN KEY ("playerAId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_playerA2Id_fkey" FOREIGN KEY ("playerA2Id") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_playerBId_fkey" FOREIGN KEY ("playerBId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_playerB2Id_fkey" FOREIGN KEY ("playerB2Id") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Challenge" ADD CONSTRAINT "Challenge_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Member"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_challengeId_fkey" FOREIGN KEY ("challengeId") REFERENCES "Challenge"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Bet" ADD CONSTRAINT "Bet_bettorId_fkey" FOREIGN KEY ("bettorId") REFERENCES "Member"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
