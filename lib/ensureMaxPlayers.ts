import { db } from "@/lib/db";

let ensured = false;
let inFlight: Promise<void> | null = null;

/**
 * Idempotent schema patch for preview/prod when `prisma migrate deploy`
 * did not run during the Vercel build (or a prior deploy left it stuck).
 */
export async function ensureMaxPlayersColumn(): Promise<void> {
  if (ensured) return;
  if (!inFlight) {
    inFlight = (async () => {
      await db.$executeRawUnsafe(
        `ALTER TABLE "Match" ADD COLUMN IF NOT EXISTS "maxPlayers" INTEGER`
      );
      ensured = true;
    })().catch((err) => {
      inFlight = null;
      throw err;
    });
  }
  await inFlight;
}
