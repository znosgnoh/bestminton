import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatLocal,
  formatSingapore,
  getSingaporeWeekday,
  singaporeDayKey,
  singaporeLocalToIso,
  toSingaporeInputDate,
  toSingaporeInputTime,
} from "./datetime";

describe("singaporeLocalToIso", () => {
  it("encodes Singapore wall time as UTC", () => {
    assert.equal(singaporeLocalToIso("2026-09-10", "20:00"), "2026-09-10T12:00:00.000Z");
  });
});

describe("toSingaporeInputDate / toSingaporeInputTime", () => {
  it("round-trips late evening Singapore time across the UTC day boundary", () => {
    const iso = "2026-09-10T16:30:00.000Z"; // 00:30 SGT next day
    assert.equal(toSingaporeInputDate(iso), "2026-09-11");
    assert.equal(toSingaporeInputTime(iso), "00:30");
  });
});

describe("singaporeDayKey / getSingaporeWeekday", () => {
  it("uses Singapore calendar day", () => {
    const lateUtc = "2026-09-10T16:00:00.000Z"; // 00:00 SGT Sep 11
    assert.equal(singaporeDayKey(lateUtc), "2026-09-11");
    assert.equal(getSingaporeWeekday(lateUtc), 5); // Friday
  });
});

describe("formatSingapore", () => {
  it("formats in Asia/Singapore regardless of host TZ", () => {
    const label = formatSingapore("2026-09-10T12:00:00.000Z", "en", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    assert.match(label, /20:00/);
  });
});

describe("formatLocal", () => {
  it("does not force Asia/Singapore", () => {
    const opts: Intl.DateTimeFormatOptions = {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "UTC",
    };
    // Explicit UTC via options proves formatLocal honors caller/host TZ params.
    const label = formatLocal("2026-09-10T12:00:00.000Z", "en", opts);
    assert.match(label, /12:00/);
  });
});
