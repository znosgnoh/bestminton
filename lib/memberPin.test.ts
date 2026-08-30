import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import {
  DEFAULT_MEMBER_PIN,
  expectedMemberPin,
  isMemberPinRequired,
  verifyMemberPin,
} from "./memberPin";

const ORIGINAL = process.env.MEMBER_PIN;

afterEach(() => {
  if (ORIGINAL === undefined) {
    delete process.env.MEMBER_PIN;
  } else {
    process.env.MEMBER_PIN = ORIGINAL;
  }
});

describe("memberPin", () => {
  it("defaults to 12345 when MEMBER_PIN is unset", () => {
    delete process.env.MEMBER_PIN;
    assert.equal(expectedMemberPin(), DEFAULT_MEMBER_PIN);
    assert.equal(isMemberPinRequired(), true);
    assert.deepEqual(verifyMemberPin(DEFAULT_MEMBER_PIN), { ok: true });
    assert.deepEqual(verifyMemberPin("wrong"), { ok: false, error: "invalid" });
    assert.deepEqual(verifyMemberPin(), { ok: false, error: "missing" });
  });

  it("uses MEMBER_PIN when set", () => {
    process.env.MEMBER_PIN = "99999";
    assert.equal(expectedMemberPin(), "99999");
    assert.deepEqual(verifyMemberPin("99999"), { ok: true });
    assert.deepEqual(verifyMemberPin(DEFAULT_MEMBER_PIN), { ok: false, error: "invalid" });
  });

  it("disables the gate when MEMBER_PIN is empty", () => {
    process.env.MEMBER_PIN = "   ";
    assert.equal(expectedMemberPin(), undefined);
    assert.equal(isMemberPinRequired(), false);
    assert.deepEqual(verifyMemberPin(), { ok: true });
  });
});
