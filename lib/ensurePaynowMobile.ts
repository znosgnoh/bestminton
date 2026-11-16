import { db } from "@/lib/db";

let ensured = false;
let inFlight: Promise<void> | null = null;

/**
 * Idempotent schema patch for preview/prod when `prisma migrate deploy`
 * did not run during the Vercel build (or a prior deploy left it stuck).
 */
export async function ensurePaynowMobileColumn(): Promise<void> {
  if (ensured) return;
  if (!inFlight) {
    inFlight = (async () => {
      await db.$executeRawUnsafe(
        `ALTER TABLE "Member" ADD COLUMN IF NOT EXISTS "paynowMobile" TEXT`
      );
      ensured = true;
    })().catch((err) => {
      inFlight = null;
      throw err;
    });
  }
  await inFlight;
}
