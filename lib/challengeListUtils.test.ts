import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  LIVE_CHALLENGE_STATUS_QUERY,
  challengeStatusWhere,
  parseChallengeStatusParam,
} from "./challengeListUtils";

describe("parseChallengeStatusParam", () => {
  it("returns undefined for empty or unknown values", () => {
    assert.equal(parseChallengeStatusParam(null), undefined);
    assert.equal(parseChallengeStatusParam(""), undefined);
    assert.equal(parseChallengeStatusParam("NOPE"), undefined);
  });

  it("parses a single status", () => {
    assert.deepEqual(parseChallengeStatusParam("COMPLETED"), ["COMPLETED"]);
  });

  it("parses comma-separated live statuses", () => {
    assert.deepEqual(parseChallengeStatusParam(LIVE_CHALLENGE_STATUS_QUERY), [
      "PENDING",
      "ACTIVE",
    ]);
  });

  it("dedupes and ignores junk tokens", () => {
    assert.deepEqual(parseChallengeStatusParam("PENDING, pending, FOO,ACTIVE"), [
      "PENDING",
      "ACTIVE",
    ]);
  });
});

describe("challengeStatusWhere", () => {
  it("omits a filter when no statuses are provided", () => {
    assert.equal(challengeStatusWhere(undefined), undefined);
    assert.equal(challengeStatusWhere([]), undefined);
  });

  it("uses equality for one status and in[] for several", () => {
    assert.deepEqual(challengeStatusWhere(["COMPLETED"]), { status: "COMPLETED" });
    assert.deepEqual(challengeStatusWhere(["PENDING", "ACTIVE"]), {
      status: { in: ["PENDING", "ACTIVE"] },
    });
  });
});
