/**
 * Run `prisma migrate deploy` with one retry if our PayNow migration is stuck
 * as failed (P3009) — common after a partial preview deploy.
 */
import { execSync } from "node:child_process";

const PAYNOW_MIGRATION = "20261116093000_member_paynow_mobile";

function run(cmd) {
  execSync(cmd, { stdio: "inherit", env: process.env });
}

try {
  run("npx prisma migrate deploy");
} catch {
  console.warn(
    `[deployMigrate] migrate deploy failed; attempting resolve --rolled-back ${PAYNOW_MIGRATION} then retry`
  );
  try {
    run(`npx prisma migrate resolve --rolled-back ${PAYNOW_MIGRATION}`);
  } catch {
    // Already applied / not failed / unknown — fall through to retry
  }
  run("npx prisma migrate deploy");
}
