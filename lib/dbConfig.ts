/** True when Postgres env vars are present (server-side only). */
export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.POSTGRES_PRISMA_URL);
}

/** IndexedDB is only used in local dev when Postgres is not configured. */
export function allowsIndexedDbFallback(): boolean {
  return process.env.NODE_ENV !== "production" && !isDatabaseConfigured();
}
