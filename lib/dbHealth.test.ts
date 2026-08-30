import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "@prisma/client";
import { formatDatabaseError, withDbRetry } from "./dbHealth";

const P2028_MESSAGE =
  "Transaction API error: Transaction not found. Transaction ID is invalid, refers to an old closed transaction Prisma doesn't have information about anymore, or was obtained before disconnecting.";

function prismaError(code: string, message: string) {
  return new Prisma.PrismaClientKnownRequestError(message, {
    code,
    clientVersion: "5.22.0",
  });
}

describe("formatDatabaseError", () => {
  it("does not leak Prisma transaction-not-found internals", () => {
    const message = formatDatabaseError(prismaError("P2028", P2028_MESSAGE));
    assert.equal(message.includes("Transaction not found"), false);
    assert.match(message, /try again/i);
  });
});

describe("withDbRetry", () => {
  it("retries P2028 then succeeds", async () => {
    let attempts = 0;
    const result = await withDbRetry(
      async () => {
        attempts += 1;
        if (attempts === 1) {
          throw prismaError("P2028", P2028_MESSAGE);
        }
        return "ok";
      },
      3,
      0
    );
    assert.equal(result, "ok");
    assert.equal(attempts, 2);
  });

  it("does not retry non-transient Prisma errors", async () => {
    let attempts = 0;
    await assert.rejects(
      () =>
        withDbRetry(
          async () => {
            attempts += 1;
            throw prismaError("P2002", "Unique constraint failed");
          },
          3,
          0
        ),
      (err: unknown) =>
        err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002"
    );
    assert.equal(attempts, 1);
  });
});
