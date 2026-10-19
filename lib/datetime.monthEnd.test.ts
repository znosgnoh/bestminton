import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isLastSingaporeCalendarDayOfMonth,
  singaporeYearMonth,
} from "./datetime";

describe("isLastSingaporeCalendarDayOfMonth", () => {
  it("is true on 31 Jan SGT", () => {
    // 2026-01-31 00:00 SGT = 2026-01-30 16:00 UTC
    assert.equal(
      isLastSingaporeCalendarDayOfMonth(new Date("2026-01-30T16:00:00.000Z")),
      true
    );
  });

  it("is false on 1 Feb SGT (midnight after month end)", () => {
    // 2026-02-01 00:00 SGT = 2026-01-31 16:00 UTC
    assert.equal(
      isLastSingaporeCalendarDayOfMonth(new Date("2026-01-31T16:00:00.000Z")),
      false
    );
  });

  it("handles February non-leap year", () => {
    // 2026-02-28 12:00 SGT
    assert.equal(
      isLastSingaporeCalendarDayOfMonth(new Date("2026-02-28T04:00:00.000Z")),
      true
    );
    assert.equal(
      isLastSingaporeCalendarDayOfMonth(new Date("2026-02-27T04:00:00.000Z")),
      false
    );
  });
});

describe("singaporeYearMonth", () => {
  it("returns YYYY-MM in SGT", () => {
    assert.equal(singaporeYearMonth(new Date("2026-01-30T16:00:00.000Z")), "2026-01");
  });
});
