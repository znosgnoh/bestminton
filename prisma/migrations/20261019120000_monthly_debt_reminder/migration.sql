-- AlterEnum
-- IF NOT EXISTS: safe if a prior failed/superseded preview already applied this value.
ALTER TYPE "EmailEventType" ADD VALUE IF NOT EXISTS 'MONTHLY_DEBT_REMINDER';
