import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { paynowQrFilename } from "./paynowSaveQr";

describe("paynowQrFilename", () => {
  it("includes sanitized name and amount", () => {
    assert.equal(
      paynowQrFilename({ name: "Alice Tan", amount: 12.5 }),
      "paynow-Alice-Tan-12-50.png"
    );
  });

  it("omits amount when missing", () => {
    assert.equal(paynowQrFilename({ name: "Bob" }), "paynow-Bob.png");
  });
});
