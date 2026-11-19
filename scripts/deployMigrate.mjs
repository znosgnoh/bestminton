/**
 * Run `prisma migrate deploy` with one retry if a recent migration is stuck
 * as failed (P3009) — common after a partial preview deploy.
 */
import { execSync } from "node:child_process";

/** Newest-first: resolve the most likely stuck migration, then retry deploy. */
const STUCK_MIGRATION_CANDIDATES = [
  "20261118120000_match_max_players",
  "20261116093000_member_paynow_mobile",
];

function run(cmd) {
  execSync(cmd, { stdio: "inherit", env: process.env });
}

try {
  run("npx prisma migrate deploy");
} catch {
  for (const migration of STUCK_MIGRATION_CANDIDATES) {
    console.warn(
      `[deployMigrate] migrate deploy failed; attempting resolve --rolled-back ${migration} then retry`
    );
    try {
      run(`npx prisma migrate resolve --rolled-back ${migration}`);
    } catch {
      // Already applied / not failed / unknown — try next candidate
    }
  }
  run("npx prisma migrate deploy");
}
