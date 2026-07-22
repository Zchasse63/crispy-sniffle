import { describe, it, expect } from "vitest";
import { openStatus } from "./hours";
import type { HoursMap } from "./types/scout";

// Monday 2026-01-05
const mon = (h: number, m: number) => new Date(2026, 0, 5, h, m);
// Saturday 2026-01-10
const sat = (h: number, m: number) => new Date(2026, 0, 10, h, m);

describe("openStatus — closing soon overnight", () => {
  it("overnight evening stretch wraps close past midnight (open, not broken math)", () => {
    // Without +1440 wrap, minutesLeft is negative and "Closes soon" can never fire
    // on the pre-midnight side of overnight hours.
    const h: HoursMap = { mon: ["22:00", "02:00"] };
    const s = openStatus(h, mon(23, 30));
    expect(s?.open).toBe(true);
    expect(s?.closingSoon).toBe(false); // 2.5h left — open, not urgency
    expect(s?.label).toMatch(/Open · closes/i);
  });

  it("overnight close within 60m on evening side → Closes soon", () => {
    const h: HoursMap = { mon: ["22:00", "00:30"] };
    const s = openStatus(h, mon(23, 45));
    expect(s?.open).toBe(true);
    expect(s?.closingSoon).toBe(true);
    expect(s?.label).toMatch(/Closes soon/i);
  });

  it("overnight close within 60m on morning carry-over → Closes soon", () => {
    // Mon 22:00–02:00 still open Tue 01:15
    const h: HoursMap = { mon: ["22:00", "02:00"] };
    const tue = new Date(2026, 0, 6, 1, 15);
    const s = openStatus(h, tue);
    expect(s?.open).toBe(true);
    expect(s?.closingSoon).toBe(true);
    expect(s?.label).toMatch(/Closes soon/i);
  });

  it("same overnight at 22:30 is open but not closing soon (>60m left)", () => {
    const h: HoursMap = { mon: ["22:00", "02:00"] };
    const s = openStatus(h, mon(22, 30));
    expect(s?.open).toBe(true);
    expect(s?.closingSoon).toBe(false);
    expect(s?.label).toMatch(/Open/i);
  });

  it("normal daytime closing soon still works", () => {
    const h: HoursMap = { mon: ["06:00", "22:00"] };
    const s = openStatus(h, mon(21, 30));
    expect(s?.closingSoon).toBe(true);
    expect(s?.label).toMatch(/Closes soon/i);
  });
});

describe("openStatus — missing day honesty", () => {
  it('day absent from map → "Hours not listed today", not Closed today', () => {
    // Monday hours only; evaluate on Saturday
    const h: HoursMap = { mon: ["06:00", "22:00"] };
    const s = openStatus(h, sat(12, 0));
    expect(s).not.toBeNull();
    expect(s!.label).toMatch(/Hours not listed today/i);
    expect(s!.label).not.toMatch(/Closed today/i);
  });

  it("missing day still hints next open when a future day exists", () => {
    const h: HoursMap = { mon: ["06:00", "22:00"] };
    // Saturday → next mon is not "tomorrow"; still should mention opens
    const s = openStatus(h, sat(12, 0));
    expect(s!.label).toMatch(/opens/i);
  });

  it("null hours → null status", () => {
    expect(openStatus(null, mon(12, 0))).toBeNull();
  });
});

describe("openStatus — overnight carry-over display", () => {
  it("sat 01:00 under fri overnight shows open with fri close", () => {
    const h: HoursMap = {
      fri: ["17:00", "02:00"],
      sat: ["08:00", "18:00"],
    };
    const s = openStatus(h, sat(1, 0));
    expect(s?.open).toBe(true);
    expect(s?.label).toMatch(/Open|Closes soon/i);
  });
});
