import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_COURT_FEE_PER_HOUR,
  DEFAULT_SHUTTLECOCK_UNIT_PRICE,
  computeSettlement,
  parseSettlementDetails,
  resolveFeeSplit,
} from "./settlement";

describe("computeSettlement", () => {
  it("adds court bookings and shuttlecocks", () => {
    const computed = computeSettlement({
      shuttlecockCount: 12,
      shuttlecockUnitPrice: DEFAULT_SHUTTLECOCK_UNIT_PRICE,
      courtFeePerHour: DEFAULT_COURT_FEE_PER_HOUR,
      bookings: [
        { memberId: 1, hours: 2 },
        { memberId: 2, hours: 2 },
      ],
    });
    assert.equal(computed.courtHours, 4);
    assert.equal(computed.courtFee, 33.5);
    assert.equal(computed.shuttlecockFee, 45);
    assert.equal(computed.totalCost, 78.5);
  });

  it("allows shuttle-only cost", () => {
    const computed = computeSettlement({
      shuttlecockCount: 4,
      shuttlecockUnitPrice: 3.75,
      courtFeePerHour: 8.375,
      bookings: [],
    });
    assert.equal(computed.courtFee, 0);
    assert.equal(computed.shuttlecockFee, 15);
    assert.equal(computed.totalCost, 15);
  });
});

describe("parseSettlementDetails", () => {
  it("rejects bad bookings", () => {
    assert.equal(
      parseSettlementDetails({
        shuttlecockCount: 0,
        shuttlecockUnitPrice: 3.75,
        courtFeePerHour: 8.375,
        bookings: [{ memberId: 0, hours: 2 }],
      }),
      null
    );
  });
});

describe("resolveFeeSplit", () => {
  it("prefers stored details over hours × rate", () => {
    const split = resolveFeeSplit(
      {
        totalCost: 78.5,
        hours: 4,
        settlementDetails: {
          shuttlecockCount: 12,
          shuttlecockUnitPrice: 3.75,
          courtFeePerHour: 8.375,
          bookings: [{ memberId: 1, hours: 4 }],
        },
      },
      7.5
    );
    assert.deepEqual(split, {
      ratePerHour: 3.75,
      shuttlecockFee: 45,
      courtFee: 33.5,
    });
  });

  it("falls back to legacy hours × rate", () => {
    const split = resolveFeeSplit({ totalCost: 100, hours: 2, settlementDetails: null }, 7.5);
    assert.equal(split?.shuttlecockFee, 15);
    assert.equal(split?.courtFee, 85);
  });
});
