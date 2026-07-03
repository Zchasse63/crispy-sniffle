import { describe, it, expect } from "vitest";
import { answerEquals, chipSetDiff, sanitizeHours, stripHiddenFields, KNOWN_FIELD_IDS } from "./diff";
import type { AnswerMap, FieldAnswer, PlanDraft, PhotoEntry } from "./answerTypes";
import type { HoursMap } from "@/lib/types/scout";

/* ── tiny answer factories (local literals, JSON-shaped like the form) ── */
const text = (value: string): FieldAnswer => ({ kind: "text", value });
const num = (value: number | null): FieldAnswer => ({ kind: "num", value });
const tri = (value: true | false | null): FieldAnswer => ({ kind: "tri", value });
const choice = (value: string | null): FieldAnswer => ({ kind: "choice", value });
const chips = (value: string[]): FieldAnswer => ({ kind: "chips", value });
const hours = (value: HoursMap | null): FieldAnswer => ({ kind: "hours", value });
const plans = (value: PlanDraft[]): FieldAnswer => ({ kind: "plans", value });
const photo = (value: PhotoEntry[]): FieldAnswer => ({ kind: "photo", value });

const plan = (over: Partial<PlanDraft> = {}): PlanDraft => ({
  name: "Standard",
  usageType: null,
  usageCount: null,
  prices: [
    { term: "month_to_month", monthly: 49 },
    { term: "12_month", monthly: 39 },
  ],
  ...over,
});

/* ════════════════════════════════════════════════════════════════════ */
describe("answerEquals — no-signal symmetry", () => {
  it("undefined vs undefined is equal", () => {
    expect(answerEquals(undefined, undefined)).toBe(true);
  });

  it("an unanswered answer equals undefined for every kind", () => {
    expect(answerEquals(text(""), undefined)).toBe(true);
    expect(answerEquals(text("   "), undefined)).toBe(true); // whitespace-only = skip
    expect(answerEquals(num(null), undefined)).toBe(true);
    expect(answerEquals(tri(null), undefined)).toBe(true);
    expect(answerEquals(choice(null), undefined)).toBe(true);
    expect(answerEquals(chips([]), undefined)).toBe(true);
    expect(answerEquals(hours(null), undefined)).toBe(true);
    expect(answerEquals(plans([]), undefined)).toBe(true);
    expect(answerEquals(photo([]), undefined)).toBe(true);
  });

  it("two unanswered answers of DIFFERENT kinds are still equal (no signal either side)", () => {
    expect(answerEquals(text(""), num(null))).toBe(true);
    expect(answerEquals(chips([]), tri(null))).toBe(true);
  });

  it("an answered value never equals undefined / an unanswered one", () => {
    expect(answerEquals(text("hi"), undefined)).toBe(false);
    expect(answerEquals(num(0), num(null))).toBe(false); // 0 is a real answer
    expect(answerEquals(chips(["sauna"]), chips([]))).toBe(false);
  });

  it("mismatched kinds with real values are never equal", () => {
    expect(answerEquals(text("15"), choice("15"))).toBe(false);
    expect(answerEquals(num(1), tri(true))).toBe(false);
  });
});

describe("answerEquals — text", () => {
  it("trims before comparing", () => {
    expect(answerEquals(text("  Alpha Gym "), text("Alpha Gym"))).toBe(true);
  });
  it("different text is unequal (case-sensitive)", () => {
    expect(answerEquals(text("Alpha"), text("alpha"))).toBe(false);
    expect(answerEquals(text("Alpha"), text("Beta"))).toBe(false);
  });
});

describe("answerEquals — num / tri / choice", () => {
  it("num strict equality", () => {
    expect(answerEquals(num(25), num(25))).toBe(true);
    expect(answerEquals(num(25), num(26))).toBe(false);
  });
  it("tri: explicit false is NOT the same as unknown null (unknown→unknown invariant)", () => {
    expect(answerEquals(tri(false), tri(null))).toBe(false);
    expect(answerEquals(tri(false), undefined)).toBe(false);
    expect(answerEquals(tri(false), tri(false))).toBe(true);
    expect(answerEquals(tri(true), tri(false))).toBe(false);
    expect(answerEquals(tri(null), tri(null))).toBe(true);
  });
  it("choice strict equality", () => {
    expect(answerEquals(choice("staffed_only"), choice("staffed_only"))).toBe(true);
    expect(answerEquals(choice("staffed_only"), choice("access_24"))).toBe(false);
  });
});

describe("answerEquals — chips (order-insensitive set semantics)", () => {
  it("same keys, different order → equal", () => {
    expect(answerEquals(chips(["sauna", "pool", "wifi"]), chips(["wifi", "sauna", "pool"]))).toBe(true);
  });
  it("duplicate keys collapse to a set", () => {
    expect(answerEquals(chips(["sauna", "sauna"]), chips(["sauna"]))).toBe(true);
  });
  it("subset / superset → unequal", () => {
    expect(answerEquals(chips(["sauna"]), chips(["sauna", "pool"]))).toBe(false);
    expect(answerEquals(chips(["sauna", "pool"]), chips(["sauna"]))).toBe(false);
  });
  it("disjoint same-size sets → unequal", () => {
    expect(answerEquals(chips(["sauna"]), chips(["pool"]))).toBe(false);
  });
});

describe("answerEquals — hours (deep, sanitized)", () => {
  const weekday: HoursMap = { mon: ["06:00", "22:00"], tue: ["06:00", "22:00"] };

  it("identical grids equal regardless of key order", () => {
    const a: HoursMap = { mon: ["06:00", "22:00"], tue: ["07:00", "21:00"] };
    const b: HoursMap = { tue: ["07:00", "21:00"], mon: ["06:00", "22:00"] };
    expect(answerEquals(hours(a), hours(b))).toBe(true);
  });

  it("a day with blank times is ignored — grid with only real days equals grid + blank day", () => {
    const withBlank: HoursMap = { ...weekday, wed: ["", ""] as [string, string] };
    expect(answerEquals(hours(withBlank), hours(weekday))).toBe(true);
  });

  it("a grid of ONLY blank days equals null / undefined (never ships as open)", () => {
    const allBlank: HoursMap = { mon: ["", ""] as [string, string] };
    expect(answerEquals(hours(allBlank), hours(null))).toBe(true);
    expect(answerEquals(hours(allBlank), undefined)).toBe(true);
  });

  it("different times → unequal", () => {
    expect(answerEquals(hours(weekday), hours({ mon: ["06:00", "22:00"], tue: ["06:00", "23:00"] }))).toBe(false);
  });

  it("open_24h flag on the value never affects grid equality (grid owns day windows only)", () => {
    expect(answerEquals(hours({ ...weekday, open_24h: true }), hours(weekday))).toBe(true);
  });
});

describe("answerEquals — plans (deep structural)", () => {
  it("identical plan drafts equal", () => {
    expect(answerEquals(plans([plan()]), plans([plan()]))).toBe(true);
  });
  it("object key order is irrelevant", () => {
    const a: PlanDraft = { name: "P", usageType: null, usageCount: null, prices: [] };
    const b = { prices: [], usageCount: null, usageType: null, name: "P" } as PlanDraft;
    // give both a real price so they count as answered
    a.prices = [{ term: "month_to_month", monthly: 10 }];
    b.prices = [{ term: "month_to_month", monthly: 10 }];
    expect(answerEquals(plans([a]), plans([b]))).toBe(true);
  });
  it("undefined optional entries are ignored (JSON round-trip parity)", () => {
    const withUndef = plan();
    (withUndef as unknown as Record<string, unknown>).carry = undefined;
    expect(answerEquals(plans([withUndef]), plans([plan()]))).toBe(true);
  });
  it("a changed price is a difference", () => {
    const changed = plan({ prices: [{ term: "month_to_month", monthly: 59 }] });
    expect(answerEquals(plans([plan()]), plans([changed]))).toBe(false);
  });
  it("array order matters for plans (arrays are positional)", () => {
    const a = plan({ name: "A" });
    const b = plan({ name: "B" });
    expect(answerEquals(plans([a, b]), plans([b, a]))).toBe(false);
  });
  it("a nameless, priceless draft row is no signal → equals undefined", () => {
    const empty: PlanDraft = { name: "", usageType: null, usageCount: null, prices: [{ term: "month_to_month", monthly: null }] };
    expect(answerEquals(plans([empty]), undefined)).toBe(true);
  });
});

describe("answerEquals — photo", () => {
  const p1: PhotoEntry = { path: "gyms/1/a.jpg", url: "https://x/a.jpg" };
  it("identical lists equal; optional tag omitted vs undefined equal", () => {
    expect(answerEquals(photo([p1]), photo([{ ...p1 }]))).toBe(true);
    expect(answerEquals(photo([{ ...p1, tag: undefined }]), photo([p1]))).toBe(true);
  });
  it("different path or tag → unequal", () => {
    expect(answerEquals(photo([p1]), photo([{ ...p1, path: "gyms/1/b.jpg" }]))).toBe(false);
    expect(answerEquals(photo([{ ...p1, tag: "floor" }]), photo([p1]))).toBe(false);
  });
});

/* ════════════════════════════════════════════════════════════════════ */
describe("chipSetDiff", () => {
  it("splits added / removed / kept", () => {
    const d = chipSetDiff(["sauna", "pool", "wifi"], ["sauna", "towels"]);
    expect(d.added.sort()).toEqual(["pool", "wifi"]);
    expect(d.removed).toEqual(["towels"]);
    expect(d.kept).toEqual(["sauna"]);
  });
  it("removing a prefilled chip is an explicit removal, never silence", () => {
    const d = chipSetDiff([], ["sauna", "pool"]);
    expect(d.removed.sort()).toEqual(["pool", "sauna"]);
    expect(d.added).toEqual([]);
    expect(d.kept).toEqual([]);
  });
  it("empty baseline → everything added", () => {
    const d = chipSetDiff(["a", "b"], []);
    expect(d.added.sort()).toEqual(["a", "b"]);
    expect(d.removed).toEqual([]);
  });
  it("identical sets → all kept", () => {
    const d = chipSetDiff(["a", "b"], ["b", "a"]);
    expect(d.added).toEqual([]);
    expect(d.removed).toEqual([]);
    expect(d.kept.sort()).toEqual(["a", "b"]);
  });
  it("duplicates in input are deduped", () => {
    const d = chipSetDiff(["a", "a"], ["a", "a", "b"]);
    expect(d.kept).toEqual(["a"]);
    expect(d.removed).toEqual(["b"]);
  });
});

/* ════════════════════════════════════════════════════════════════════ */
describe("sanitizeHours", () => {
  it("null in → null out", () => {
    expect(sanitizeHours(null)).toBeNull();
  });

  it("keeps complete days verbatim", () => {
    const v: HoursMap = { mon: ["06:00", "22:00"], sat: ["08:00", "20:00"] };
    expect(sanitizeHours(v)).toEqual({ mon: ["06:00", "22:00"], sat: ["08:00", "20:00"] });
  });

  it("drops a day toggled open with a blank OPEN time", () => {
    const v: HoursMap = { mon: ["", "22:00"] as [string, string], tue: ["06:00", "22:00"] };
    expect(sanitizeHours(v)).toEqual({ tue: ["06:00", "22:00"] });
  });

  it("drops a day toggled open with a blank CLOSE time", () => {
    const v: HoursMap = { mon: ["06:00", ""] as [string, string], tue: ["06:00", "22:00"] };
    expect(sanitizeHours(v)).toEqual({ tue: ["06:00", "22:00"] });
  });

  it("returns null when NO complete day remains (blank-only grid must not ship)", () => {
    expect(sanitizeHours({ mon: ["", ""] as [string, string], tue: ["", "20:00"] as [string, string] })).toBeNull();
    expect(sanitizeHours({} as HoursMap)).toBeNull();
  });

  it("strips the open_24h flag — the grid owns day windows only", () => {
    const out = sanitizeHours({ open_24h: true, mon: ["06:00", "22:00"] });
    expect(out).toEqual({ mon: ["06:00", "22:00"] });
    expect(out && "open_24h" in out).toBe(false);
  });

  it("open_24h alone (no complete days) → null, not a fabricated 24h window", () => {
    expect(sanitizeHours({ open_24h: true })).toBeNull();
  });
});

/* ════════════════════════════════════════════════════════════════════ */
describe("stripHiddenFields — branch gating", () => {
  it("null segment defaults to the strength branch: strength fields kept, pilates dropped", () => {
    const answers: AnswerMap = {
      e_freeweights: chips(["dumbbells"]),
      e_pilates: chips(["reformer"]),
    };
    const out = stripHiddenFields(answers, null);
    expect(out.e_freeweights).toEqual(chips(["dumbbells"]));
    expect(out.e_pilates).toBeUndefined();
  });

  it("yoga_pilates segment: pilates fields kept, strength-branch fields stripped (cross-branch laundering blocked)", () => {
    const answers: AnswerMap = {
      e_pilates: chips(["reformer", "mats"]),
      e_freeweights: chips(["barbells"]), // stale from a segment switch — must go
      e_machines: chips(["leg_press"]),
    };
    const out = stripHiddenFields(answers, "yoga_pilates");
    expect(out.e_pilates).toEqual(chips(["reformer", "mats"]));
    expect(out.e_freeweights).toBeUndefined();
    expect(out.e_machines).toBeUndefined();
  });

  it("branch-less fields (e.g. e_recovery, d_amenities) survive any segment", () => {
    const answers: AnswerMap = {
      e_recovery: chips(["foam_roller"]),
      d_amenities: chips(["sauna"]),
    };
    const out = stripHiddenFields(answers, "cycling");
    expect(out.e_recovery).toEqual(chips(["foam_roller"]));
    expect(out.d_amenities).toEqual(chips(["sauna"]));
  });

  it("secondary segments union in their branch (C5): yoga gym + strength secondary keeps strength fields", () => {
    const answers: AnswerMap = {
      a_secondary: chips(["strength"]),
      e_pilates: chips(["reformer"]),
      e_freeweights: chips(["dumbbells"]),
    };
    const out = stripHiddenFields(answers, "yoga_pilates");
    expect(out.e_pilates).toEqual(chips(["reformer"]));
    expect(out.e_freeweights).toEqual(chips(["dumbbells"]));
  });
});

describe("stripHiddenFields — showIf gating", () => {
  it("b_hours is stripped when access is staffed_24, kept when staffed_only", () => {
    const grid = hours({ mon: ["06:00", "22:00"] });
    const hidden = stripHiddenFields({ b_access: choice("staffed_24"), b_hours: grid }, "strength");
    expect(hidden.b_hours).toBeUndefined();
    expect(hidden.b_access).toEqual(choice("staffed_24"));

    const shown = stripHiddenFields({ b_access: choice("staffed_only"), b_hours: grid }, "strength");
    expect(shown.b_hours).toEqual(grid);
  });

  it("c_daypass is stripped when drop-ins are membership_only", () => {
    const out = stripHiddenFields({ c_dropin: choice("membership_only"), c_daypass: num(20) }, "strength");
    expect(out.c_daypass).toBeUndefined();
    expect(out.c_dropin).toEqual(choice("membership_only"));
  });

  it("nested showIf inside a branch: e_pilates_fw needs e_pilates_strength === true", () => {
    const base: AnswerMap = { e_pilates_fw: chips(["dumbbells"]) };
    expect(stripHiddenFields(base, "yoga_pilates").e_pilates_fw).toBeUndefined();
    expect(
      stripHiddenFields({ ...base, e_pilates_strength: tri(false) }, "yoga_pilates").e_pilates_fw,
    ).toBeUndefined();
    expect(
      stripHiddenFields({ ...base, e_pilates_strength: tri(true) }, "yoga_pilates").e_pilates_fw,
    ).toEqual(chips(["dumbbells"]));
  });
});

describe("stripHiddenFields — unknown keys and virtual fields", () => {
  it("drops unknown / tampered keys", () => {
    const out = stripHiddenFields(
      { a_name: text("Alpha"), __evil: text("drop me"), not_a_field: num(1) },
      "strength",
    );
    expect(out.a_name).toEqual(text("Alpha"));
    expect(out.__evil).toBeUndefined();
    expect(out.not_a_field).toBeUndefined();
  });

  it("PRESERVES the virtual i_photo_rights affirmation for every segment (incl. null)", () => {
    const answers: AnswerMap = { i_photo_rights: tri(true) };
    expect(stripHiddenFields(answers, "strength").i_photo_rights).toEqual(tri(true));
    expect(stripHiddenFields(answers, "yoga_pilates").i_photo_rights).toEqual(tri(true));
    expect(stripHiddenFields(answers, null).i_photo_rights).toEqual(tri(true));
  });

  it("empty answers → empty result", () => {
    expect(stripHiddenFields({}, "strength")).toEqual({});
  });
});

/* ════════════════════════════════════════════════════════════════════ */
describe("KNOWN_FIELD_IDS", () => {
  it("contains declared form fields from short and full paths", () => {
    for (const id of ["a_name", "a_segment", "b_hours", "c_daypass", "d_amenities", "e_machines", "m_plans", "f_kind", "h_vibes", "i_photos", "j_voice", "ct_email"]) {
      expect(KNOWN_FIELD_IDS.has(id)).toBe(true);
    }
  });
  it("contains the virtual photo-rights id", () => {
    expect(KNOWN_FIELD_IDS.has("i_photo_rights")).toBe(true);
  });
  it("rejects unknown ids", () => {
    expect(KNOWN_FIELD_IDS.has("bogus_field")).toBe(false);
    expect(KNOWN_FIELD_IDS.has("")).toBe(false);
  });
});
