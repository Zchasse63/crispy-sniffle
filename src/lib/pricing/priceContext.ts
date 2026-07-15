import type { EnrichedGym, GymSegment, PriceBand, PriceContext } from "@/lib/types/scout";
import { SEGMENT_LABELS } from "@/lib/types/scout";

export type { PriceBand, PriceContext };

/**
 * Minimal structural subset `computePriceBands`/`priceContext` need — same
 * `Pick`-off-`EnrichedGym` pattern as `AccessFields` (lib/access.ts) and
 * `CompletenessFields` (lib/completeness.ts), so any `EnrichedGym`/`ScoredGym`
 * satisfies it without a cast.
 */
export type PriceFields = Pick<EnrichedGym, "day_pass_price" | "segment">;

/**
 * Per-segment cohorts plus one metro-wide band. `metroName` is baked in at
 * construction (DiscoveryClient passes `city.name`) so `priceContext` never
 * needs a third argument to build an honest `cohortLabel`.
 */
export interface PriceBands {
  bySegment: Partial<Record<GymSegment, PriceBand>>;
  metro: PriceBand;
  metroName: string;
}

/** Safe all-null-ish default — mirrors EMPTY_FILTER_SET's role in scout.ts.
 *  Every gate in `priceContext` fails against this (n:0 < any threshold), so
 *  a caller that hasn't computed real bands yet gets silence, never a
 *  fabricated claim. */
export const EMPTY_PRICE_BANDS: PriceBands = {
  bySegment: {},
  metro: { n: 0, p25: 0, p50: 0, p75: 0 },
  metroName: "",
};

/** A segment cohort needs at least this many LISTED prices before a gym's
 *  price is compared against it — below this the sample is too thin to call
 *  anything "typical" (never-fabricate: an honesty gate, not a UX nicety). */
export const COHORT_MIN_N = 20;
/** Metro-wide fallback gate — a coarser cohort, so it needs a much larger n. */
export const METRO_MIN_N = 100;
/** "At least 20% below the median" — the value-callout bar. */
export const VALUE_CALLOUT_RATIO = 0.8;

/**
 * Linear-interpolation percentile (aka "R-7" — the numpy/Excel
 * `PERCENTILE.INC` default) over an ASCENDING-sorted array. Deterministic:
 * for odd-length arrays it lands exactly on the middle element; for
 * even-length arrays (p=0.5) it lands exactly halfway between the two middle
 * elements. No odd/even special-casing needed.
 */
function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = p * (sortedAsc.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  return sortedAsc[lo] + (idx - lo) * (sortedAsc[hi] - sortedAsc[lo]);
}

/**
 * Builds one `{n,p25,p50,p75}` band from a list of (already non-null)
 * prices. Edges round to whole dollars with `Math.round` — bands recompute
 * on every request, so without rounding a stray $0.50 could land a gym on
 * either side of a boundary depending on which request happened to compute
 * it. `Math.round` (not floor/ceil) keeps the error unbiased in either
 * direction; ceiling every edge would systematically inflate "below
 * typical"'s bar (band.p50 too), floor would do the opposite. Everything
 * downstream (`priceContext`) compares against these ROUNDED numbers only —
 * no parallel raw value survives construction — so there is never a second
 * representation of an edge for a boundary case to disagree with.
 */
function buildBand(prices: number[]): PriceBand {
  if (prices.length === 0) return { n: 0, p25: 0, p50: 0, p75: 0 };
  const sorted = [...prices].sort((a, b) => a - b);
  return {
    n: sorted.length,
    p25: Math.round(percentile(sorted, 0.25)),
    p50: Math.round(percentile(sorted, 0.5)),
    p75: Math.round(percentile(sorted, 0.75)),
  };
}

function segmentCohortLabel(segment: GymSegment, n: number): string {
  return `${SEGMENT_LABELS[segment].toLowerCase()} gyms (${n} listed)`;
}

function metroCohortLabel(metroName: string, n: number): string {
  return `${metroName} gyms (${n} listed)`;
}

/**
 * Computes per-segment cohorts plus one metro-wide band from every gym with
 * a listed `day_pass_price`. Pure/deterministic — no I/O, no randomness.
 * Callers should compute this ONCE per gym list (see DiscoveryClient's
 * `useMemo` over the full, unfiltered `gyms` prop — bands describe the
 * market, not a narrowed search result).
 *
 * `metroName` is a required second argument (not part of the gym data
 * itself — `EnrichedGym` only carries a `city_id` uuid, never a display
 * name) so the honesty-qualifier copy ("Tampa gyms (110 listed)") stays
 * correct across every metro Scout serves, never hardcoded to one city.
 */
export function computePriceBands(gyms: PriceFields[], metroName: string): PriceBands {
  const bySegmentPrices: Partial<Record<GymSegment, number[]>> = {};
  const metroPrices: number[] = [];
  for (const gym of gyms) {
    if (gym.day_pass_price === null) continue;
    metroPrices.push(gym.day_pass_price);
    if (gym.segment !== null) {
      (bySegmentPrices[gym.segment] ??= []).push(gym.day_pass_price);
    }
  }
  const bySegment: Partial<Record<GymSegment, PriceBand>> = {};
  for (const segment of Object.keys(bySegmentPrices) as GymSegment[]) {
    bySegment[segment] = buildBand(bySegmentPrices[segment]!);
  }
  return { bySegment, metro: buildBand(metroPrices), metroName };
}

/**
 * Per-gym price framing against `bands`. HARD honesty gates, checked in this
 * exact precedence:
 *   1. `gym.day_pass_price === null` → always `null`. An unlisted gym NEVER
 *      gets a typical-price substitute (never-fabricate) — checked first,
 *      unconditionally, before any band lookup.
 *   2. `gym.segment`'s cohort has `n >= COHORT_MIN_N` → use that cohort.
 *   3. else `bands.metro` has `n >= METRO_MIN_N` → use the metro band.
 *   4. else → `null` (sample too thin to honestly call anything "typical").
 *
 * Within whichever band is chosen: `price <= p25` → "below typical";
 * `price >= p75` → "above typical"; else "typical" (p25 checked first, so a
 * degenerate band where p25 === p75 still resolves to "below typical").
 *
 * `valueCallout` fires only when the gym is "below typical" AND priced at
 * least 20% under the band's `p50` (`VALUE_CALLOUT_RATIO`) — sitting at p25
 * alone isn't necessarily a "great value" if the cohort is tightly
 * clustered.
 */
export function priceContext(gym: PriceFields, bands: PriceBands): PriceContext | null {
  if (gym.day_pass_price === null) return null;
  const price = gym.day_pass_price;

  let band: PriceBand;
  let cohortLabel: string;
  const segBand = gym.segment !== null ? bands.bySegment[gym.segment] : undefined;
  if (segBand && segBand.n >= COHORT_MIN_N) {
    band = segBand;
    cohortLabel = segmentCohortLabel(gym.segment as GymSegment, band.n);
  } else if (bands.metro.n >= METRO_MIN_N) {
    band = bands.metro;
    cohortLabel = metroCohortLabel(bands.metroName, band.n);
  } else {
    return null;
  }

  const label: PriceContext["label"] =
    price <= band.p25 ? "below typical" : price >= band.p75 ? "above typical" : "typical";

  let valueCallout: PriceContext["valueCallout"] = null;
  if (label === "below typical" && band.p50 > 0 && price <= band.p50 * VALUE_CALLOUT_RATIO) {
    const percentBelow = Math.round((1 - price / band.p50) * 100);
    valueCallout = { percentBelow, label: `Great value — ${percentBelow}% below typical` };
  }

  return { label, cohortLabel, valueCallout };
}
