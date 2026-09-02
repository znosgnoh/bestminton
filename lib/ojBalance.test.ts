import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { summaryFromOjBalance, maxSettleAmount } from "./ojBalance";

describe("summaryFromOjBalance", () => {
  it("maps positive to owing / netCam", () => {
    assert.deepEqual(summaryFromOjBalance(3), {
      totalOwed: 0,
      totalOwing: 3,
      netCam: 3,
    });
  });
  it("maps negative to owed", () => {
    assert.deepEqual(summaryFromOjBalance(-2), {
      totalOwed: 2,
      totalOwing: 0,
      netCam: -2,
    });
  });
});

describe("maxSettleAmount", () => {
  it("is min of positive and |negative|", () => {
    assert.equal(maxSettleAmount(5, -3), 3);
    assert.equal(maxSettleAmount(2, -9), 2);
    assert.equal(maxSettleAmount(0, -1), 0);
    assert.equal(maxSettleAmount(4, 1), 0);
  });
});
