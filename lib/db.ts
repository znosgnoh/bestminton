import { PrismaClient } from "@prisma/client";

/** Bump when pool URL params change so Hot Reload replaces a stale PrismaClient. */
const POOL_CONFIG_VERSION = "v2-neon-small-pool";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaPoolVersion?: string;
};

/**
 * Neon + Prisma: keep the client-side pool small and allow cold-start wake time.
 * Defaults (~num_cpus*2+1 connections, 10s pool_timeout) routinely fail against
 * Neon's pooler under Turbopack HMR — and a cached global client never picks up
 * later URL tweaks unless we version-bust it.
 */
function datasourceUrl(): string | undefined {
  const raw = process.env.POSTGRES_PRISMA_URL;
  if (!raw) return undefined;

  try {
    const url = new URL(raw);
    // Always overwrite — env may omit these and an old client may have used defaults.
    url.searchParams.set(
      "connection_limit",
      process.env.NODE_ENV === "production" ? "5" : "2"
    );
    url.searchParams.set("pool_timeout", "30");
    url.searchParams.set("connect_timeout", "30");
    return url.toString();
  } catch {
    return raw;
  }
}

function createPrismaClient(): PrismaClient {
  const url = datasourceUrl();
  return new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : [],
    ...(url ? { datasources: { db: { url } } } : {}),
  });
}

function getPrismaClient(): PrismaClient {
  if (
    globalForPrisma.prisma &&
    globalForPrisma.prismaPoolVersion === POOL_CONFIG_VERSION
  ) {
    return globalForPrisma.prisma;
  }

  if (globalForPrisma.prisma) {
    void globalForPrisma.prisma.$disconnect().catch(() => {});
  }

  const client = createPrismaClient();
  globalForPrisma.prisma = client;
  globalForPrisma.prismaPoolVersion = POOL_CONFIG_VERSION;
  return client;
}

export const db = getPrismaClient();
