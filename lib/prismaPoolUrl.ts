/**
 * Neon + Prisma: keep the client-side pool small and allow cold-start wake time.
 * Defaults (~num_cpus*2+1 connections, 10s pool_timeout) routinely fail against
 * Neon's pooler. Interactive transactions also need pgbouncer=true so Prisma
 * uses the simple query protocol — otherwise PgBouncer recycles the session
 * and Prisma throws P2028 ("Transaction not found").
 *
 * Production uses connection_limit=1: each Vercel isolate should hold one
 * client connection and let Neon PgBouncer multiplex; higher limits fan out
 * into P2024 pool timeouts under concurrent traffic.
 */
export function applyPrismaPoolParams(raw: string, nodeEnv = process.env.NODE_ENV): string {
  const url = new URL(raw);
  url.searchParams.set("connection_limit", nodeEnv === "production" ? "1" : "2");
  url.searchParams.set("pool_timeout", "30");
  url.searchParams.set("connect_timeout", "30");
  if (url.hostname.includes("-pooler")) {
    url.searchParams.set("pgbouncer", "true");
  }
  return url.toString();
}
