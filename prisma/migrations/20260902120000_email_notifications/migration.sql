ALTER TABLE "Member" ADD COLUMN "emailNotificationsEnabled" BOOLEAN NOT NULL DEFAULT true;

CREATE TYPE "EmailEventType" AS ENUM (
  'MATCH_CREATED',
  'MATCH_REMINDER_96H',
  'MATCH_REMINDER_48H',
  'CHALLENGE_RESOLVED',
  'DRINK_DEBT_SETTLED',
  'LEDGER_RECORDED',
  'LEDGER_MARK_PAID'
);

CREATE TABLE "EmailDelivery" (
  "id" SERIAL NOT NULL,
  "memberId" INTEGER NOT NULL,
  "eventType" "EmailEventType" NOT NULL,
  "entityKey" TEXT NOT NULL,
  "resendId" TEXT,
  "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "EmailDelivery_memberId_fkey" FOREIGN KEY ("memberId") REFERENCES "Member"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "EmailDelivery_memberId_eventType_entityKey_key"
  ON "EmailDelivery"("memberId", "eventType", "entityKey");
CREATE INDEX "EmailDelivery_eventType_entityKey_idx"
  ON "EmailDelivery"("eventType", "entityKey");
