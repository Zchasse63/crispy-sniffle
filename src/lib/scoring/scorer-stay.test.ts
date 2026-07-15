/**
 * Unit tests for `openDuringStay` — the trips-as-container "open during your
 * stay" tally. Complements scorer.test.ts / scorer-hours.test.ts (same file,
 * same DAY_KEYS/day-of-week conventions) but this function answers a
 * date-range question, not a time-of-day question, so it gets its own file.
 */
import { describe, it, expect } from "vitest";
import { openDuringStay } from "./scorer";
import type { HoursMap } from "@/lib/types/scout";

describe("openDuringStay — null / degenerate hours", () => {
  it("null hours → whole stay unknown", () => {
    expect(openDuringStay(null, "2026-07-20", "2026-07-24")).toEqual({
      openDays: 0,
      closedDays: 0,
      unknown: true,
    });
  });

  it("empty hours map ({}) → whole stay unknown, not closed", () => {
    expect(openDuringStay({}, "2026-07-20", "2026-07-24")).toEqual({
      openDays: 0,
      closedDays: 0,
      unknown: true,
    });
  });

  it("open_24h short-circuits to every day open, regardless of any day tuples", () => {
    const h: HoursMap = { open_24h: true };
    expect(openDuringStay(h, "2026-07-20", "2026-07-24")).toEqual({
      openDays: 5,
      closedDays: 0,
      unknown: false,
    });
  });
});

describe("openDuringStay — single day and weekend-spanning stays", () => {
  // 2026-07-20 is a Monday; the 5-day window below runs Mon..Fri.
  const WEEKDAYS_ONLY: HoursMap = {
    mon: ["06:00", "22:00"],
    tue: ["06:00", "22:00"],
    wed: ["06:00", "22:00"],
    thu: ["06:00", "22:00"],
    fri: ["06:00", "22:00"],
    // sat/sun deliberately omitted — a populated map with weekend days missing
  };

  it("single-day stay counts exactly one day", () => {
    expect(openDuringStay(WEEKDAYS_ONLY, "2026-07-20", "2026-07-20")).toEqual({
      openDays: 1,
      closedDays: 0,
      unknown: false,
    });
  });

  it("a Mon-Fri window against weekdays-only hours is fully open", () => {
    expect(openDuringStay(WEEKDAYS_ONLY, "2026-07-20", "2026-07-24")).toEqual({
      openDays: 5,
      closedDays: 0,
      unknown: false,
    });
  });

  it("a window spanning into the weekend counts missing sat/sun as closed", () => {
    // 2026-07-20 (Mon) .. 2026-07-26 (Sun) = 7 days, 5 open (Mon-Fri), 2 closed (Sat/Sun)
    expect(openDuringStay(WEEKDAYS_ONLY, "2026-07-20", "2026-07-26")).toEqual({
      openDays: 5,
      closedDays: 2,
      unknown: false,
    });
  });

  it("a weekend-only stay against weekdays-only hours is fully closed, not unknown", () => {
    // 2026-07-25 (Sat) .. 2026-07-26 (Sun)
    expect(openDuringStay(WEEKDAYS_ONLY, "2026-07-25", "2026-07-26")).toEqual({
      openDays: 0,
      closedDays: 2,
      unknown: false,
    });
  });
});

describe("openDuringStay — never-fabricate: blank/malformed tuples are unknown, not closed", () => {
  it("a blank tuple on a day within the stay is flagged unknown, not counted closed or open", () => {
    const h: HoursMap = { mon: ["", ""], tue: ["06:00", "22:00"] };
    // 2026-07-20 Mon, 2026-07-21 Tue
    expect(openDuringStay(h, "2026-07-20", "2026-07-21")).toEqual({
      openDays: 1,
      closedDays: 0,
      unknown: true,
    });
  });

  it("garbage time tokens are unknown, not open", () => {
    const h: HoursMap = { mon: ["abc", "xyz"] };
    expect(openDuringStay(h, "2026-07-20", "2026-07-20")).toEqual({
      openDays: 0,
      closedDays: 0,
      unknown: true,
    });
  });

  it("a day with any closed day still reports unknown=true if another day is also indeterminate", () => {
    // Mon closed (missing), Tue blank tuple (unknown), Wed valid (open)
    const h: HoursMap = { wed: ["06:00", "22:00"] };
    const withBlankTue: HoursMap = { ...h, tue: ["", "22:00"] };
    expect(openDuringStay(withBlankTue, "2026-07-20", "2026-07-22")).toEqual({
      openDays: 1, // wed
      closedDays: 1, // mon (missing key)
      unknown: true, // tue (blank open time)
    });
  });
});

describe("openDuringStay — '24:00'/'00:00' close tokens are valid, not malformed", () => {
  it("a '24:00' close on every day of the stay counts as open (end-of-day, not garbage)", () => {
    const h: HoursMap = { mon: ["06:00", "24:00"], tue: ["06:00", "24:00"] };
    expect(openDuringStay(h, "2026-07-20", "2026-07-21")).toEqual({
      openDays: 2,
      closedDays: 0,
      unknown: false,
    });
  });
});
