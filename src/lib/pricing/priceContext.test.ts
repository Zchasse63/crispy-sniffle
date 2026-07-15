import { describe, it, expect } from "vitest";
import {
  computePriceBands,
  priceContext,
  COHORT_MIN_N,
  METRO_MIN_N,
  type PriceBand,
  type PriceBands,
  type PriceFields,
} from "./priceContext";

function makeGym(overrides: Partial<PriceFields> = {}): PriceFields {
  return { day_pass_price: null, segment: null, ...overrides };
}

function makeBand(overrides: Partial<PriceBand> = {}): PriceBand {
  return { n: 0, p25: 0, p50: 0, p75: 0, ...overrides };
}

function makeBands(overrides: Partial<PriceBands> = {}): PriceBands {
  return { bySegment: {}, metro: makeBand(), metroName: "Test City", ...overrides };
}

// The `computePriceBands` describe block exercises real percentile math end
// to end (real price arrays). The `priceContext` block below deliberately
// uses hand-built `PriceBand`/`PriceBands` fixtures via makeBand/makeBands to
// isolate gating/tone/rounding logic from percentile arithmetic — those
// fixtures don't need `n` and `p25/p50/p75` to cohere the way real data
// would.

describe("computePriceBands", () => {
  it("odd-n: lands exactly on the middle element, no interpolation", () => {
    const gyms = [10, 20, 30, 40, 50].map((p) => makeGym({ day_pass_price: p, segment: "strength" }));
    const bands = computePriceBands(gyms, "Test City");
    expect(bands.bySegment.strength).toEqual({ n: 5, p25: 20, p50: 30, p75: 40 });
  });

  it("even-n: interpolates between the two middle elements, then rounds", () => {
    const gyms = [10, 20, 30, 40, 50, 60].map((p) => makeGym({ day_pass_price: p, segment: "strength" }));
    const bands = computePriceBands(gyms, "Test City");
    // raw p25 = 22.5 -> 23, raw p50 = 35 -> 35, raw p75 = 47.5 -> 48
    expect(bands.bySegment.strength).toEqual({ n: 6, p25: 23, p50: 35, p75: 48 });
  });

  it("excludes null day_pass_price from both the segment cohort and the metro band", () => {
    const gyms = [
      makeGym({ day_pass_price: 20, segment: "strength" }),
      makeGym({ day_pass_price: null, segment: "strength" }),
      makeGym({ day_pass_price: 30, segment: "strength" }),
    ];
    const bands = computePriceBands(gyms, "Test City");
    expect(bands.bySegment.strength?.n).toBe(2);
    expect(bands.metro.n).toBe(2);
  });

  it("excludes null-segment gyms from bySegment but still counts them in metro", () => {
    const gyms = [
      makeGym({ day_pass_price: 20, segment: null }),
      makeGym({ day_pass_price: 30, segment: "strength" }),
    ];
    const bands = computePriceBands(gyms, "Test City");
    expect(bands.bySegment.strength?.n).toBe(1);
    expect(Object.keys(bands.bySegment)).toEqual(["strength"]);
    expect(bands.metro.n).toBe(2);
  });

  it("metro aggregates across every segment regardless of cohort", () => {
    const gyms = [
      makeGym({ day_pass_price: 20, segment: "strength" }),
      makeGym({ day_pass_price: 30, segment: "yoga_pilates" }),
      makeGym({ day_pass_price: 40, segment: "boutique" }),
    ];
    const bands = computePriceBands(gyms, "Test City");
    expect(bands.metro.n).toBe(3);
    expect(bands.metro).toEqual({ n: 3, p25: 25, p50: 30, p75: 35 });
  });

  it("empty input never throws and yields a zeroed band", () => {
    const bands = computePriceBands([], "Test City");
    expect(bands.metro).toEqual({ n: 0, p25: 0, p50: 0, p75: 0 });
    expect(bands.bySegment).toEqual({});
  });

  it("bakes metroName into the returned bands", () => {
    const bands = computePriceBands([], "Tampa");
    expect(bands.metroName).toBe("Tampa");
  });
});

describe("priceContext — unlisted gyms never get a price context", () => {
  it("returns null when day_pass_price is null, even against enormous bands", () => {
    const bands = makeBands({
      bySegment: { strength: makeBand({ n: 10_000, p25: 10, p50: 20, p75: 30 }) },
      metro: makeBand({ n: 10_000, p25: 10, p50: 20, p75: 30 }),
    });
    const gym = makeGym({ day_pass_price: null, segment: "strength" });
    expect(priceContext(gym, bands)).toBeNull();
  });
});

describe("priceContext — cohort gate", () => {
  it(`n=${COHORT_MIN_N - 1} falls through to the metro band`, () => {
    const bands = makeBands({
      bySegment: { strength: makeBand({ n: COHORT_MIN_N - 1, p25: 10, p50: 20, p75: 30 }) },
      metro: makeBand({ n: METRO_MIN_N, p25: 40, p50: 50, p75: 60 }),
    });
    const gym = makeGym({ day_pass_price: 45, segment: "strength" });
    const ctx = priceContext(gym, bands);
    expect(ctx).not.toBeNull();
    expect(ctx?.cohortLabel).toBe(`Test City gyms (${METRO_MIN_N} listed)`);
  });

  it(`n=${COHORT_MIN_N} uses the segment cohort`, () => {
    const bands = makeBands({
      bySegment: { strength: makeBand({ n: COHORT_MIN_N, p25: 10, p50: 20, p75: 30 }) },
      metro: makeBand({ n: METRO_MIN_N, p25: 40, p50: 50, p75: 60 }),
    });
    const gym = makeGym({ day_pass_price: 15, segment: "strength" });
    const ctx = priceContext(gym, bands);
    expect(ctx).not.toBeNull();
    expect(ctx?.cohortLabel).toBe(`strength & powerlifting gyms (${COHORT_MIN_N} listed)`);
  });
});

describe("priceContext — metro gate", () => {
  it(`metro n=${METRO_MIN_N - 1} with no qualifying segment -> null`, () => {
    const bands = makeBands({ metro: makeBand({ n: METRO_MIN_N - 1, p25: 10, p50: 20, p75: 30 }) });
    const gym = makeGym({ day_pass_price: 15, segment: null });
    expect(priceContext(gym, bands)).toBeNull();
  });

  it(`metro n=${METRO_MIN_N} with no qualifying segment -> uses the metro band`, () => {
    const bands = makeBands({ metro: makeBand({ n: METRO_MIN_N, p25: 10, p50: 20, p75: 30 }) });
    const gym = makeGym({ day_pass_price: 15, segment: null });
    const ctx = priceContext(gym, bands);
    expect(ctx).not.toBeNull();
    expect(ctx?.cohortLabel).toBe(`Test City gyms (${METRO_MIN_N} listed)`);
  });
});

describe("priceContext — threshold edges", () => {
  const bands = makeBands({ metro: makeBand({ n: METRO_MIN_N, p25: 20, p50: 30, p75: 40 }) });

  it("price === p25 exactly -> below typical", () => {
    const ctx = priceContext(makeGym({ day_pass_price: 20 }), bands);
    expect(ctx?.label).toBe("below typical");
  });

  it("price === p75 exactly -> above typical", () => {
    const ctx = priceContext(makeGym({ day_pass_price: 40 }), bands);
    expect(ctx?.label).toBe("above typical");
  });

  it("price strictly between p25 and p75 -> typical", () => {
    const ctx = priceContext(makeGym({ day_pass_price: 30 }), bands);
    expect(ctx?.label).toBe("typical");
  });
});

describe("priceContext — rounding stability ($0.50 drift must not flip a label)", () => {
  // Real 7-price cohort: [10,12,15,18,24,25,30]. Raw (pre-round) percentiles:
  // p25 = 13.5 -> rounds to 14; p75 = 24.5 -> rounds to 25. The band stores
  // ONLY the rounded 25 — there is no parallel raw 24.5 anywhere for a
  // boundary case to be compared against.
  const bands = makeBands({
    metro: makeBand({ n: METRO_MIN_N, p25: 14, p50: 18, p75: 25 }),
  });

  it("a gym at the raw (pre-round) boundary of $24.50 reads as typical, not above typical", () => {
    const ctx = priceContext(makeGym({ day_pass_price: 24.5 }), bands);
    expect(ctx?.label).toBe("typical");
  });

  it("a gym at the rounded edge of $25.00 reads as above typical", () => {
    const ctx = priceContext(makeGym({ day_pass_price: 25 }), bands);
    expect(ctx?.label).toBe("above typical");
  });
});

describe("priceContext — 20%-below-p50 value-callout rule", () => {
  const bands = makeBands({
    metro: makeBand({ n: METRO_MIN_N, p25: 85, p50: 100, p75: 120 }),
  });

  it("at p25 but not 20% below the median -> below typical, no value callout", () => {
    const ctx = priceContext(makeGym({ day_pass_price: 85 }), bands);
    expect(ctx?.label).toBe("below typical");
    expect(ctx?.valueCallout).toBeNull();
  });

  it("comfortably past the 20%-below line -> value callout fires", () => {
    const ctx = priceContext(makeGym({ day_pass_price: 79 }), bands);
    expect(ctx?.valueCallout).toEqual({ percentBelow: 21, label: "Great value — 21% below typical" });
  });

  it("exactly at the 20%-below line (inclusive) -> value callout fires", () => {
    const ctx = priceContext(makeGym({ day_pass_price: 80 }), bands);
    expect(ctx?.valueCallout).toEqual({ percentBelow: 20, label: "Great value — 20% below typical" });
  });

  it("just over the 20%-below line -> value callout does not fire", () => {
    const ctx = priceContext(makeGym({ day_pass_price: 80.01 }), bands);
    expect(ctx?.label).toBe("below typical");
    expect(ctx?.valueCallout).toBeNull();
  });

  it("typical and above-typical tones never carry a value callout", () => {
    const typical = priceContext(makeGym({ day_pass_price: 100 }), bands);
    const above = priceContext(makeGym({ day_pass_price: 120 }), bands);
    expect(typical?.valueCallout).toBeNull();
    expect(above?.valueCallout).toBeNull();
  });
});

describe("priceContext — cohortLabel format", () => {
  it("segment cohortLabel uses SEGMENT_LABELS lowercased + count + 'listed'", () => {
    const bands = makeBands({
      bySegment: { yoga_pilates: makeBand({ n: 46, p25: 20, p50: 30, p75: 40 }) },
    });
    const ctx = priceContext(makeGym({ day_pass_price: 25, segment: "yoga_pilates" }), bands);
    expect(ctx?.cohortLabel).toBe("yoga & pilates gyms (46 listed)");
  });

  it("metro cohortLabel uses metroName + count + 'listed'", () => {
    const bands = makeBands({
      metroName: "Tampa",
      metro: makeBand({ n: 110, p25: 20, p50: 30, p75: 40 }),
    });
    const ctx = priceContext(makeGym({ day_pass_price: 25, segment: null }), bands);
    expect(ctx?.cohortLabel).toBe("Tampa gyms (110 listed)");
  });
});
