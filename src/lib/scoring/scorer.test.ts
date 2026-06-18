import { describe, it, expect } from "vitest";
import { scoreGyms, isOpenNow } from "./scorer";
import { EMPTY_FILTER_SET, type FilterSet } from "@/lib/types/scout";
import { makeGym, amenity, equipment } from "@/lib/testFactory";

function filters(over: Partial<FilterSet> = {}): FilterSet {
  return { ...EMPTY_FILTER_SET, ...over, equipment: { ...EMPTY_FILTER_SET.equipment, ...(over.equipment ?? {}) } };
}

describe("scoreGyms — empty filterset", () => {
  it("returns null scores and sorts by rating then name", () => {
    const a = makeGym({ name: "Alpha", rating: 4.2 });
    const b = makeGym({ name: "Beta", rating: 4.8 });
    const c = makeGym({ name: "Gamma", rating: null });
    const out = scoreGyms([a, c, b], EMPTY_FILTER_SET);
    expect(out.map((g) => g.name)).toEqual(["Beta", "Alpha", "Gamma"]);
    expect(out.every((g) => g.matchScore === null)).toBe(true);
  });
});

describe("scoreGyms — amenity coverage", () => {
  it("100% when the only requested amenity is present, with a reason", () => {
    const g = makeGym({ amenities: [amenity("sauna")] });
    const [scored] = scoreGyms([g], filters({ amenities: ["sauna"] }));
    expect(scored.matchScore).toBe(100);
    expect(scored.matchReasons.some((r) => /sauna/i.test(r))).toBe(true);
  });

  it("partial credit + honest miss when one of two is absent", () => {
    const g = makeGym({ amenities: [amenity("sauna")] });
    const [scored] = scoreGyms([g], filters({ amenities: ["sauna", "pool"] }));
    expect(scored.matchScore).toBe(50);
    expect(scored.missingItems.some((m) => /pool/i.test(m))).toBe(true);
  });
});

describe("scoreGyms — Kodawari rule (soft vs hard)", () => {
  it("preferredSegments NEVER excludes — a non-matching gym still appears", () => {
    const yoga = makeGym({ segment: "yoga_pilates", amenities: [amenity("sauna")] });
    const out = scoreGyms([yoga], filters({ preferredSegments: ["strength"], amenities: ["sauna"] }));
    expect(out).toHaveLength(1); // soft preference does not filter it out
  });

  it("hard segments DO exclude", () => {
    const yoga = makeGym({ segment: "yoga_pilates" });
    const lift = makeGym({ segment: "strength" });
    const out = scoreGyms([yoga, lift], filters({ segments: ["strength"] }));
    expect(out).toHaveLength(1);
    expect(out[0].segment).toBe("strength");
  });
});

describe("scoreGyms — price exclusion", () => {
  it("excludes gyms priced over maxDayPass but keeps unknown-price gyms", () => {
    const cheap = makeGym({ name: "Cheap", day_pass_price: 15 });
    const pricey = makeGym({ name: "Pricey", day_pass_price: 40 });
    const unknown = makeGym({ name: "Unknown", day_pass_price: null });
    const out = scoreGyms([cheap, pricey, unknown], filters({ maxDayPass: 25 }));
    const names = out.map((g) => g.name);
    expect(names).toContain("Cheap");
    expect(names).toContain("Unknown"); // unknown price passes through with a note
    expect(names).not.toContain("Pricey");
  });
});

describe("scoreGyms — equipment + dumbbell weight", () => {
  it("rewards meeting the dumbbell weight floor", () => {
    const g = makeGym({ equipment: [equipment("dumbbells", { max_weight_lbs: 150 })] });
    const [scored] = scoreGyms([g], filters({ equipment: { keys: [], minSquatRacks: null, minDumbbellWeight: 100, brands: [] } }));
    expect(scored.matchScore).toBe(100);
  });

  it("partial credit when dumbbells exist but max weight is unknown", () => {
    const g = makeGym({ equipment: [equipment("dumbbells", { max_weight_lbs: null })] });
    const [scored] = scoreGyms([g], filters({ equipment: { keys: [], minSquatRacks: null, minDumbbellWeight: 100, brands: [] } }));
    expect(scored.matchScore).toBeGreaterThan(0);
    expect(scored.matchScore).toBeLessThan(100);
  });
});

describe("isOpenNow", () => {
  const MON_1030 = new Date(2026, 0, 5, 10, 30); // Jan 5 2026 = Monday

  it("null hours → null (unknown)", () => {
    expect(isOpenNow(null, MON_1030)).toBeNull();
  });

  it("open_24h → always true", () => {
    expect(isOpenNow({ open_24h: true }, MON_1030)).toBe(true);
  });

  it("within today's range → true; outside → false", () => {
    expect(isOpenNow({ mon: ["06:00", "22:00"] }, MON_1030)).toBe(true);
    expect(isOpenNow({ mon: ["12:00", "22:00"] }, MON_1030)).toBe(false);
  });

  it("no entry for today → null (unknown for today)", () => {
    expect(isOpenNow({ tue: ["06:00", "22:00"] }, MON_1030)).toBeNull();
  });

  it("overnight range wraps past midnight", () => {
    const mon_0100 = new Date(2026, 0, 5, 1, 0); // 1am Monday
    expect(isOpenNow({ mon: ["22:00", "06:00"] }, mon_0100)).toBe(true);
    const mon_1200 = new Date(2026, 0, 5, 12, 0);
    expect(isOpenNow({ mon: ["22:00", "06:00"] }, mon_1200)).toBe(false);
  });

  it("close time 00:00 means end-of-day midnight, not start", () => {
    const mon_2330 = new Date(2026, 0, 5, 23, 30);
    expect(isOpenNow({ mon: ["06:00", "00:00"] }, mon_2330)).toBe(true);
  });
});
