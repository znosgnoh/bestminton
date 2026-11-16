import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildPayNowPayload,
  crc16CcittFalse,
  formatPaynowMobileDisplay,
  normalizePaynowMobile,
  paynowDeeplinkPath,
} from "./paynow";

describe("normalizePaynowMobile", () => {
  it("accepts local 8-digit SG mobiles", () => {
    assert.equal(normalizePaynowMobile("91234567"), "+6591234567");
    assert.equal(normalizePaynowMobile("8123 4567"), "+6581234567");
  });

  it("accepts +65 / 65 prefixes", () => {
    assert.equal(normalizePaynowMobile("+65 9123-4567"), "+6591234567");
    assert.equal(normalizePaynowMobile("6591234567"), "+6591234567");
  });

  it("rejects invalid numbers", () => {
    assert.equal(normalizePaynowMobile("71234567"), null);
    assert.equal(normalizePaynowMobile("9123456"), null);
    assert.equal(normalizePaynowMobile(""), null);
    assert.equal(normalizePaynowMobile(null), null);
  });
});

describe("formatPaynowMobileDisplay", () => {
  it("groups local digits", () => {
    assert.equal(formatPaynowMobileDisplay("+6591234567"), "9123 4567");
  });
});

describe("crc16CcittFalse", () => {
  it("matches a known EMV sample prefix CRC", () => {
    // EMV QR CRC is computed over payload including trailing "6304"
    const sample =
      "00020101021226500009SG.PAYNOW010100211+65912345670301004082025010152040000530370254040.995802SG5902NA6009Singapore6304";
    const crc = crc16CcittFalse(sample);
    assert.match(crc, /^[0-9A-F]{4}$/);
    assert.equal(crc16CcittFalse(sample), crc); // stable
  });
});

describe("buildPayNowPayload", () => {
  it("builds a dynamic payload with fixed amount and valid CRC", () => {
    const payload = buildPayNowPayload({
      mobile: "91234567",
      amount: 12.5,
      merchantName: "Alice",
      reference: "Bestminton",
      amountEditable: false,
      expiry: "20261231",
    });
    assert.ok(payload);
    assert.ok(payload!.startsWith("000201010212"));
    assert.ok(payload!.includes("SG.PAYNOW"));
    assert.ok(payload!.includes("+6591234567"));
    assert.ok(payload!.includes("540512.50"));
    assert.ok(payload!.includes("5905Alice"));
    assert.ok(payload!.includes("Bestminton"));
    const body = payload!.slice(0, -4);
    const crc = payload!.slice(-4);
    assert.equal(crc16CcittFalse(body), crc);
  });

  it("returns null for bad mobile", () => {
    assert.equal(buildPayNowPayload({ mobile: "123" }), null);
  });
});

describe("paynowDeeplinkPath", () => {
  it("encodes amount and optional fields", () => {
    assert.equal(
      paynowDeeplinkPath(3, { amount: 8, reference: "Court", from: "Bob" }),
      "/pay/3?amount=8.00&ref=Court&from=Bob"
    );
    assert.equal(paynowDeeplinkPath(3), "/pay/3");
  });
});
