/**
 * Hours-focused unit tests for isOpenNow + openNow filtering in scoreGyms.
 *
 * Complements scorer.test.ts (which already covers: null hours → null,
 * open_24h → true, basic in/out of range, missing today → null, a basic
 * overnight wrap, and close "00:00" = end-of-day). This file covers exact
 * boundary minutes, blank/garbage time tuples (the audit-noted "blank day
 * must not read as open 24h" fabrication), "24:00" close, day-key mapping,
 * and how scoreGyms' openNow hard filter treats open/closed/unknown gyms.
 *
 * isOpenNow and scoreGyms both accept an injectable `now: Date`, so every
 * test here is fully deterministic.
 */
import { describe, it, expect } from "vitest";
import { isOpenNow, scoreGyms } from "./scorer";
import { EMPTY_FILTER_SET, type FilterSet, type HoursMap } from "@/lib/types/scout";
import { makeGym } from "@/lib/testFactory";

function filters(over: Partial<FilterSet> = {}): FilterSet {
  return {
    ...EMPTY_FILTER_SET,
    ...over,
    equipment: { ...EMPTY_FILTER_SET.equipment, ...(over.equipment ?? {}) },
  };
}

/** Local-time Date builder — Jan 5 2026 is a Monday. */
const mon = (h: number, m = 0) => new Date(2026, 0, 5, h, m);

describe("isOpenNow — exact boundary minutes", () => {
  const HOURS: HoursMap = { mon: ["06:00", "22:00"] };

  it("is open at exactly the opening minute (inclusive)", () => {
    expect(isOpenNow(HOURS, mon(6, 0))).toBe(true);
  });

  it("is closed one minute before opening", () => {
    expect(isOpenNow(HOURS, mon(5, 59))).toBe(false);
  });

  it("is closed at exactly the closing minute (exclusive)", () => {
    expect(isOpenNow(HOURS, mon(22, 0))).toBe(false);
  });

  it("is open one minute before closing", () => {
    expect(isOpenNow(HOURS, mon(21, 59))).toBe(true);
  });

  it("respects minute-level open times like 06:30", () => {
    const h: HoursMap = { mon: ["06:30", "22:00"] };
    expect(isOpenNow(h, mon(6, 29))).toBe(false);
    expect(isOpenNow(h, mon(6, 30))).toBe(true);
  });
});

describe("isOpenNow — blank / incomplete time tuples (audit: no fabricated 24h)", () => {
  // A day "toggled open" with blank times must NEVER read as open 00:00-24:00.
  //
  // CURRENT CODE BUG (scorer.ts toMins, ~line 38-43): Number("") === 0, so a
  // blank open time parses as 00:00, and a blank CLOSE time parses as 0 which
  // the end-of-day rule then promotes to 1440 ("24:00"). A blank tuple is
  // therefore fabricated into open 00:00-24:00 — exactly the audit-noted
  // failure mode. The tests in this block assert the correct (never-open /
  // unknown) behavior and are expected to FAIL until scorer.ts validates
  // time strings before trusting them.
  it("fully blank tuple is never treated as open", () => {
    const h: HoursMap = { mon: ["", ""] };
    expect(isOpenNow(h, mon(0, 0))).not.toBe(true);
    expect(isOpenNow(h, mon(12, 0))).not.toBe(true);
    expect(isOpenNow(h, mon(23, 59))).not.toBe(true);
  });

  it("blank open time with a real close time is never treated as open", () => {
    const h: HoursMap = { mon: ["", "22:00"] };
    expect(isOpenNow(h, mon(10, 0))).not.toBe(true);
  });

  it("real open time with a blank close time is never treated as open", () => {
    const h: HoursMap = { mon: ["06:00", ""] };
    expect(isOpenNow(h, mon(10, 0))).not.toBe(true);
  });

  it("non-numeric garbage times are never treated as open", () => {
    const h: HoursMap = { mon: ["abc", "xyz"] };
    expect(isOpenNow(h, mon(12, 0))).not.toBe(true);
  });

  // A blank tuple is UNKNOWN data, and NEVER-FABRICATE says unknown stays
  // null. isOpenNow returns null for missing hours and a missing day; a blank
  // tuple carries the same information content and should behave identically
  // (null), not be coerced into an open/closed assertion.
  it("fully blank tuple reports unknown (null), not a fabricated open/closed", () => {
    const h: HoursMap = { mon: ["", ""] };
    expect(isOpenNow(h, mon(12, 0))).toBeNull();
  });
});

describe('isOpenNow — "24:00" close and midnight-spanning semantics', () => {
  it('close "24:00" means end of day: open late evening, closed at midnight next day', () => {
    const h: HoursMap = { mon: ["06:00", "24:00"], tue: ["06:00", "24:00"] };
    expect(isOpenNow(h, mon(23, 59))).toBe(true);
    // 00:00 Tuesday: tue range says closed until 06:00
    expect(isOpenNow(h, new Date(2026, 0, 6, 0, 0))).toBe(false);
  });

  it('["00:00","00:00"] is the all-day form (close 00:00 = end-of-day midnight)', () => {
    const h: HoursMap = { mon: ["00:00", "00:00"] };
    expect(isOpenNow(h, mon(0, 0))).toBe(true);
    expect(isOpenNow(h, mon(12, 0))).toBe(true);
    expect(isOpenNow(h, mon(23, 59))).toBe(true);
  });
});

describe("isOpenNow — overnight wrap boundaries", () => {
  const NIGHT: HoursMap = { mon: ["22:00", "06:00"] };

  it("open at exactly the overnight opening minute", () => {
    expect(isOpenNow(NIGHT, mon(22, 0))).toBe(true);
  });

  it("open one minute before the overnight close", () => {
    expect(isOpenNow(NIGHT, mon(5, 59))).toBe(true);
  });

  it("closed at exactly the overnight closing minute", () => {
    expect(isOpenNow(NIGHT, mon(6, 0))).toBe(false);
  });

  it("keys strictly on today's day: Tue 01:00 with only a mon overnight range is unknown", () => {
    // The wrap check uses TODAY's tuple, not "yesterday's range spilling over".
    // Documented behavior: hours data is expected to carry the range on each
    // day it applies to.
    const tue0100 = new Date(2026, 0, 6, 1, 0); // Tuesday
    expect(isOpenNow(NIGHT, tue0100)).toBeNull();
  });
});

describe("isOpenNow — day-key mapping and sparse maps", () => {
  it("Sunday uses the sun key", () => {
    const sun1000 = new Date(2026, 0, 4, 10, 0); // Jan 4 2026 = Sunday
    expect(isOpenNow({ sun: ["08:00", "18:00"] }, sun1000)).toBe(true);
    expect(isOpenNow({ mon: ["08:00", "18:00"] }, sun1000)).toBeNull();
  });

  it("Saturday uses the sat key", () => {
    const sat1000 = new Date(2026, 0, 10, 10, 0); // Jan 10 2026 = Saturday
    expect(isOpenNow({ sat: ["08:00", "18:00"] }, sat1000)).toBe(true);
  });

  it("empty hours object → null (no fabricated open)", () => {
    expect(isOpenNow({}, mon(12, 0))).toBeNull();
  });

  it("open_24h explicitly false with no day entries → null", () => {
    expect(isOpenNow({ open_24h: false }, mon(12, 0))).toBeNull();
  });

  it("open_24h true short-circuits even when a day range would say closed", () => {
    expect(isOpenNow({ open_24h: true, mon: ["06:00", "22:00"] }, mon(3, 0))).toBe(true);
  });

  it("hour-only times without minutes still parse (lenient)", () => {
    expect(isOpenNow({ mon: ["6", "22"] }, mon(10, 0))).toBe(true);
    expect(isOpenNow({ mon: ["6", "22"] }, mon(22, 30))).toBe(false);
  });
});

describe("scoreGyms — openNow hard filter", () => {
  // scoreGyms evaluates each gym's hours in the gym's OWN timezone (nowInZone),
  // so pin the gyms to UTC and inject UTC instants — deterministic regardless of
  // the test runner's local zone. (Jan 5 2026 is a Monday.)
  const utcMon = (h: number, m = 0) => new Date(Date.UTC(2026, 0, 5, h, m));
  const NOW = utcMon(10, 0); // Monday 10:00 in the gym's (UTC) zone
  const tz = "UTC";

  it("keeps open gyms, excludes closed gyms, passes unknown-hours gyms through", () => {
    const open = makeGym({ name: "OpenGym", timezone: tz, hours: { mon: ["06:00", "22:00"] } });
    const closed = makeGym({ name: "ClosedGym", timezone: tz, hours: { mon: ["12:00", "22:00"] } });
    const unknown = makeGym({ name: "UnknownGym", timezone: tz, hours: null });
    const out = scoreGyms([open, closed, unknown], filters({ openNow: true }), NOW);
    const names = out.map((g) => g.name);
    expect(names).toContain("OpenGym");
    expect(names).toContain("UnknownGym"); // unknown passes through with a note
    expect(names).not.toContain("ClosedGym");
  });

  it("open gym earns the 'Open now' reason; unknown gym gets an honest missing note", () => {
    const open = makeGym({ name: "OpenGym", timezone: tz, hours: { mon: ["06:00", "22:00"] } });
    const unknown = makeGym({ name: "UnknownGym", timezone: tz, hours: null });
    const out = scoreGyms([open, unknown], filters({ openNow: true }), NOW);
    const openScored = out.find((g) => g.name === "OpenGym")!;
    const unknownScored = out.find((g) => g.name === "UnknownGym")!;
    expect(openScored.matchScore).toBe(100);
    expect(openScored.matchReasons).toContain("Open now");
    expect(unknownScored.matchReasons).not.toContain("Open now");
    expect(unknownScored.missingItems.some((m) => /hours unknown/i.test(m))).toBe(true);
  });

  it("open_24h gym passes the openNow filter regardless of hours map", () => {
    const g = makeGym({ name: "AllDay", timezone: tz, open_24h: true, hours: null });
    const out = scoreGyms([g], filters({ openNow: true }), NOW);
    expect(out).toHaveLength(1);
    expect(out[0].matchReasons).toContain("Open now");
  });

  // Blank-tuple day must not read as a fabricated "Open now" (toMins returns
  // null for "", so isOpenNow returns null → no open credit).
  it("openNow never fabricates 'Open now' for a blank-tuple day", () => {
    const g = makeGym({ name: "BlankHours", timezone: tz, hours: { mon: ["", ""] } });
    const out = scoreGyms([g], filters({ openNow: true }), NOW);
    for (const scored of out) {
      expect(scored.matchReasons).not.toContain("Open now");
    }
  });

  // A blank tuple is unknown-shaped data, so the gym must NOT be hard-excluded
  // by the openNow filter (unknown passes through with a note).
  it("a blank-tuple gym passes through the openNow filter like other unknown-hours gyms", () => {
    const g = makeGym({ name: "BlankHours", timezone: tz, hours: { mon: ["", ""] } });
    const out = scoreGyms([g], filters({ openNow: true }), NOW);
    expect(out.map((x) => x.name)).toContain("BlankHours");
  });

  it("scoreGyms uses the injected now for time-of-day boundaries", () => {
    const g = makeGym({ name: "Boundary", timezone: tz, hours: { mon: ["06:00", "22:00"] } });
    expect(scoreGyms([g], filters({ openNow: true }), utcMon(21, 59))).toHaveLength(1);
    expect(scoreGyms([g], filters({ openNow: true }), utcMon(22, 0))).toHaveLength(0);
  });
});
