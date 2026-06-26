import { Prisma } from "@prisma/client";
import { db } from "./db";
import { isDatabaseConfigured } from "./dbConfig";

/** Fields added after initial Challenge model — used to detect a stale generated client. */
const REQUIRED_CHALLENGE_FIELDS = [
  "confirmedHandicapPoints",
  "confirmedScore",
  "winnerId",
] as const;

export function isPrismaClientCurrent(): boolean {
  const fields = Prisma.ChallengeScalarFieldEnum;
  return REQUIRED_CHALLENGE_FIELDS.every((field) => field in fields);
}

export type DbProbeResult =
  | { ok: true }
  | {
      ok: false;
      reason: "not_configured" | "stale_client" | "unreachable" | "schema_out_of_date";
      message: string;
    };

export async function probeDatabase(): Promise<DbProbeResult> {
  if (!isDatabaseConfigured()) {
    return {
      ok: false,
      reason: "not_configured",
      message:
        "POSTGRES_PRISMA_URL is not set. Configure Postgres env vars for kèo and leaderboard features.",
    };
  }

  if (!isPrismaClientCurrent()) {
    return {
      ok: false,
      reason: "stale_client",
      message:
        "Prisma Client is out of date. Run: npx prisma generate — then restart the dev server.",
    };
  }

  try {
    await db.$queryRaw`SELECT 1`;
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      reason: probeFailureReason(err),
      message: formatDatabaseError(err),
    };
  }
}

function probeFailureReason(
  err: unknown
): "unreachable" | "schema_out_of_date" {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2022") {
    return "schema_out_of_date";
  }
  return "unreachable";
}

export function formatDatabaseError(err: unknown): string {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2022") {
      return "Database schema is out of date. Run: npx prisma migrate deploy";
    }
    if (err.code === "P1001") {
      return "Cannot reach the database server. Check POSTGRES_PRISMA_URL and network access.";
    }
  }

  if (err instanceof Prisma.PrismaClientValidationError) {
    if (!isPrismaClientCurrent()) {
      return "Prisma Client is out of date. Run: npx prisma generate — then restart the dev server.";
    }
    return "Database query failed due to a schema/client mismatch.";
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }

  return "Database unavailable.";
}

export function logDatabaseError(context: string, err: unknown): void {
  if (process.env.NODE_ENV === "development") {
    console.error(`[${context}]`, err);
  }
}
