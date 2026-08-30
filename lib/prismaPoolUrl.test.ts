import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyPrismaPoolParams } from "./prismaPoolUrl";

describe("applyPrismaPoolParams", () => {
  it("sets pgbouncer=true on Neon pooler hosts so interactive transactions work", () => {
    const url = applyPrismaPoolParams(
      "postgresql://user:pass@ep-foo-pooler.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
      "production"
    );
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("pgbouncer"), "true");
    assert.equal(parsed.searchParams.get("connection_limit"), "5");
  });

  it("does not force pgbouncer on a direct Neon host", () => {
    const url = applyPrismaPoolParams(
      "postgresql://user:pass@ep-foo.ap-southeast-1.aws.neon.tech/neondb?sslmode=require",
      "production"
    );
    const parsed = new URL(url);
    assert.equal(parsed.searchParams.get("pgbouncer"), null);
  });
});
