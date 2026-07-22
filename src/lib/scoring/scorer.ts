/**
 * Deterministic, explainable match scoring.
 *
 * The LLM (or fallback parser) only ever produces a FilterSet.
 * Scores and reasons come from THIS code — never from a model, never random.
 *
 * Weights (sum 100):
 *   amenity coverage 30 · equipment-key coverage 25 · squat-rack count 10 ·
 *   dumbbell max weight 10 · brand match 10 · price 10 · hours 5
 * Criteria not requested are excluded and the score is normalized over the
 * weights actually in play, so "sauna only" can still be a 100% match.
 */
import {
  AMENITY_LABELS,
  EMPTY_FILTER_SET,
  EQUIPMENT_LABELS,
  SEGMENT_LABELS,
  isEmptyFilterSet,
  type AmenityKey,
  type EnrichedGym,
  type FilterSet,
  type HoursMap,
  type ScoredGym,
  VIBE_LABELS,
} from "@/lib/types/scout";
import { completeness } from "@/lib/completeness";
import { nowInZone } from "@/lib/tz";


const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function isOpenNow(hours: HoursMap | null, now: Date = new Date()): boolean | null {
  if (!hours) return null; // unknown
  if (hours.open_24h) return true;
  const dayIdx = now.getDay();
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMins = (t: string, isClose = false): number | null => {
    // Blank/malformed times are UNKNOWN, never 0 — a blank "" must not read as
    // 00:00 (open) or, via the end-of-day rule below, 24:00 (close). Fabricating
    // an "open 24h" window from an empty tuple violates NEVER-FABRICATE. Minutes
    // stay optional so a lenient "9" still parses as 09:00.
    const s = (t ?? "").trim();
    if (!/^\d{1,2}(:\d{1,2})?$/.test(s)) return null;
    const [h, m] = s.split(":").map(Number);
    const total = h * 60 + (Number.isFinite(m) ? m : 0);
    // "00:00"/"24:00" as a CLOSE time means end-of-day midnight, not start
    return isClose && total === 0 ? 1440 : total;
  };

  // Yesterday's overnight carry-over: fri 17:00–02:00 must read open at
  // Sat 01:00 even when sat has its own non-overnight range (or none).
  const yday = DAY_KEYS[(dayIdx + 6) % 7];
  const yrange = hours[yday];
  if (yrange) {
    const yo = toMins(yrange[0]);
    const yc = toMins(yrange[1], true);
    if (yo !== null && yc !== null && yc <= yo && mins < yc) {
      return true;
    }
  }

  const range = hours[DAY_KEYS[dayIdx]];
  if (!range) return null; // unknown for today (and not in yesterday's wrap)
  const o = toMins(range[0]);
  const c = toMins(range[1], true);
  if (o === null || c === null) return null; // incomplete hours today → unknown
  if (c <= o) return mins >= o || mins < c; // same-day overnight range
  return mins >= o && mins < c;
}

/** Exported for facet counting (DiscoveryClient) — one implementation per
 *  concern, not a re-derived "does this gym have X" check per surface. */
export function hasAmenity(gym: EnrichedGym, key: AmenityKey): boolean {
  if (key === "open_24h" && gym.open_24h) return true;
  return gym.amenities.some((a) => a.amenity_key === key && a.present);
}

/** Hard exclusions only — segment/neighborhood/hours/price gates that
 *  actually remove a gym from the pool. Amenity/equipment/vibe/brand
 *  preferences never appear here — they RANK via the weighted scoring below,
 *  they don't exclude. Exported so facet counts (DiscoveryClient) count
 *  against the exact same pool scoreGyms will show, without re-implementing
 *  this gate (one implementation per concern, repo CLAUDE.md rule 5). */
export function passesHardFilters(
  gym: EnrichedGym,
  filters: FilterSet,
  now: Date = new Date(),
): boolean {
  if (filters.segments.length > 0) {
    if (!gym.segment || !filters.segments.includes(gym.segment)) return false;
  }
  if (filters.neighborhood) {
    if (
      !gym.neighborhood ||
      gym.neighborhood.toLowerCase() !== filters.neighborhood.toLowerCase()
    )
      return false;
  }
  if (filters.open24h && gym.open_24h !== true) return false;
  if (filters.openNow) {
    // Evaluate hours in the GYM's timezone, not the caller's (viewer/server) clock.
    const open = gym.open_24h === true || isOpenNow(gym.hours, nowInZone(gym.timezone, now));
    if (open === false) return false; // unknown hours pass through with a note
  }
  if (
    filters.maxDayPass !== null &&
    gym.day_pass_price !== null &&
    gym.day_pass_price > filters.maxDayPass
  )
    return false;
  return true;
}

export function scoreGyms(
  gyms: EnrichedGym[],
  filters: FilterSet = EMPTY_FILTER_SET,
  now: Date = new Date(),
): ScoredGym[] {
  if (isEmptyFilterSet(filters)) {
    return [...gyms]
      .sort(byCompletenessThenRatingThenName)
      .map((gym) => ({ ...gym, matchScore: null, matchReasons: [], missingItems: [] }));
  }

  // ── hard filters (exclusions) ────────────────────────────────────
  const pool = gyms.filter((gym) => passesHardFilters(gym, filters, now));

  // ── weighted coverage scoring ────────────────────────────────────
  const scored = pool.map((gym): ScoredGym => {
    const reasons: string[] = [];
    const missing: string[] = [];
    let earned = 0;
    let inPlay = 0;

    // Amenities — 30
    if (filters.amenities.length > 0) {
      inPlay += 30;
      const per = 30 / filters.amenities.length;
      for (const key of filters.amenities) {
        if (hasAmenity(gym, key)) {
          earned += per;
          // An estimated/low-confidence fact must never read as a confirmed
          // "Has X" (brand rule: estimates carry visible hedging everywhere,
          // including match reasons on cards / map popups / MatchBadge).
          const rec = gym.amenities.find((a) => a.amenity_key === key && a.present);
          const estimated = rec !== undefined && (rec.source === "estimated" || rec.confidence <= 0.7);
          reasons.push(
            estimated
              ? `${AMENITY_LABELS[key]} (estimated)`
              : `Has ${AMENITY_LABELS[key].toLowerCase()}`,
          );
        } else {
          missing.push(`No ${AMENITY_LABELS[key].toLowerCase()} listed`);
        }
      }
    }

    // Equipment keys — 25
    if (filters.equipment.keys.length > 0) {
      inPlay += 25;
      const per = 25 / filters.equipment.keys.length;
      for (const key of filters.equipment.keys) {
        const rec = gym.equipment.find((e) => e.equipment_key === key);
        if (rec) {
          earned += per;
          // suppress generic reasons when a more specific one will fire below
          const coveredByWeight =
            key === "dumbbells" && filters.equipment.minDumbbellWeight !== null;
          const coveredByRacks =
            (key === "squat_rack" || key === "power_rack") &&
            filters.equipment.minSquatRacks !== null;
          if (!coveredByWeight && !coveredByRacks) {
            const label = EQUIPMENT_LABELS[key];
            // Same hedging rule as amenities: estimated equipment never reads
            // as a confirmed "Has X" in a match reason.
            const estimated = rec.source === "estimated" || rec.confidence <= 0.7;
            reasons.push(
              estimated
                ? `${label} (estimated)`
                : rec.quantity && rec.quantity > 1
                  ? `${rec.quantity}× ${label.toLowerCase()}`
                  : `Has ${label.toLowerCase()}`,
            );
          }
        } else {
          missing.push(`No ${EQUIPMENT_LABELS[key].toLowerCase()} listed`);
        }
      }
    }

    // Preferred facility type (soft, from NL parsing) — 15
    if (filters.preferredSegments.length > 0) {
      inPlay += 15;
      if (gym.segment && filters.preferredSegments.includes(gym.segment)) {
        earned += 15;
        reasons.push(`${SEGMENT_LABELS[gym.segment]} spot`);
      } else {
        const wanted = filters.preferredSegments
          .map((s) => SEGMENT_LABELS[s].toLowerCase())
          .join(" / ");
        missing.push(`Not a ${wanted} spot`);
      }
    }

    // Preferred vibes (soft, from NL parsing) — 10. Same principle as
    // segments: vibes boost, never exclude.
    if (filters.preferredVibes.length > 0) {
      inPlay += 10;
      const matched = filters.preferredVibes.filter((v) => gym.vibe_tags.includes(v));
      if (matched.length > 0) {
        earned += (10 * matched.length) / filters.preferredVibes.length;
        reasons.push(
          `${matched.map((v) => VIBE_LABELS[v]).join(" · ")} vibe${matched.length > 1 ? "s" : ""}`,
        );
      } else {
        missing.push(
          `Not known for a ${filters.preferredVibes
            .map((v) => VIBE_LABELS[v].toLowerCase())
            .join(" / ")} vibe`,
        );
      }
    }

    // Squat rack count — 10
    if (filters.equipment.minSquatRacks !== null) {
      inPlay += 10;
      const racks = gym.equipment
        .filter((e) => e.equipment_key === "squat_rack" || e.equipment_key === "power_rack")
        .reduce((sum, e) => sum + (e.quantity ?? 1), 0);
      if (racks >= filters.equipment.minSquatRacks) {
        earned += 10;
        reasons.push(`${racks} squat racks`);
      } else if (racks > 0) {
        earned += 5;
        reasons.push(`${racks} squat racks (you asked for ${filters.equipment.minSquatRacks}+)`);
      } else {
        missing.push("No squat racks listed");
      }
    }

    // Dumbbell max weight — 10
    if (filters.equipment.minDumbbellWeight !== null) {
      inPlay += 10;
      const db = gym.equipment.find((e) => e.equipment_key === "dumbbells");
      const max = db?.max_weight_lbs ?? null;
      if (max !== null) {
        const frac = Math.min(max / filters.equipment.minDumbbellWeight, 1);
        earned += 10 * frac;
        if (frac >= 1) reasons.push(`Dumbbells to ${max} lbs`);
        else missing.push(`Dumbbells top out at ${max} lbs`);
      } else if (db) {
        earned += 4; // has dumbbells, weight unknown
        missing.push("Dumbbell max weight unknown");
      } else {
        missing.push("No dumbbells listed");
      }
    }

    // Brand match — 10
    if (filters.equipment.brands.length > 0) {
      inPlay += 10;
      const wanted = filters.equipment.brands.map((b) => b.toLowerCase());
      const matched = new Set<string>();
      for (const e of gym.equipment) {
        if (e.brand && wanted.some((w) => e.brand!.toLowerCase().includes(w))) {
          matched.add(e.brand);
        }
      }
      if (matched.size > 0) {
        earned += 10;
        reasons.push(`${[...matched].join(", ")} equipment`);
      } else {
        missing.push(`No ${filters.equipment.brands.join("/")} equipment listed`);
      }
    }

    // Price — 10
    if (filters.maxDayPass !== null) {
      inPlay += 10;
      if (gym.day_pass_price !== null) {
        earned += 10; // exclusion already removed over-budget gyms
        reasons.push(`Day pass $${Number(gym.day_pass_price).toFixed(0)}`);
      } else {
        missing.push("Day-pass price unknown");
      }
    }

    // Hours — 5
    if (filters.open24h || filters.openNow) {
      inPlay += 5;
      if (filters.open24h && gym.open_24h === true) {
        earned += 5;
        reasons.push("Open 24 hours");
      } else if (filters.openNow) {
        const open = gym.open_24h === true || isOpenNow(gym.hours, nowInZone(gym.timezone, now));
        if (open === true) {
          earned += 5;
          reasons.push("Open now");
        } else {
          missing.push("Hours unknown");
        }
      }
    }

    const matchScore =
      inPlay > 0 ? Math.round((earned / inPlay) * 100) : null;
    return { ...gym, matchScore, matchReasons: reasons, missingItems: missing };
  });

  return scored.sort((a, b) => {
    const d = (b.matchScore ?? 0) - (a.matchScore ?? 0);
    if (d !== 0) return d;
    return byCompletenessThenRatingThenName(a, b);
  });
}

/** Tally of a gym's published day-of-week hours across a trip's stay window.
 *  `openDays`/`closedDays` count only WEEKDAYS with a determinate answer;
 *  `unknown` flags that at least one day in the window couldn't be
 *  determined (never-fabricate: a blank/malformed tuple is unknown, not
 *  closed). Consumed by TripDetail for a post-score re-rank nudge + an
 *  honest per-gym "open during your stay" line — never a hard filter. */
export interface StayOpenTally {
  openDays: number;
  closedDays: number;
  unknown: boolean;
}

/** Day-of-week openness across `[startDate, endDate]` (both YYYY-MM-DD,
 *  inclusive) — NOT the same question `isOpenNow` answers. `isOpenNow` is
 *  time-of-day-relative (is this exact instant inside today's range);
 *  `openDuringStay` only needs, for each calendar date in the window, "does
 *  this weekday have a published range at all" — so it re-derives day
 *  classification from `hours` directly rather than calling `isOpenNow` once
 *  per day with a synthetic clock time.
 *
 *  Reuses this file's DAY_KEYS (mon..sun via Date#getDay()) and the same
 *  "blank/malformed time token is unknown, never a fabricated open/closed"
 *  convention `isOpenNow`'s `toMins` applies — mirrored here (not extracted)
 *  to avoid touching `toMins`'s already-tested boundary behavior.
 *
 *  Classification per calendar day:
 *    - `hours` null                              → whole stay unknown
 *    - `hours.open_24h`                           → every day in range open
 *    - hours map has NO day keys at all (`{}`)    → whole stay unknown
 *      (mirrors `isOpenNow({}, …) → null` — a degenerate map is unknown,
 *      not "closed every day")
 *    - day key absent from an otherwise-populated map → that day is CLOSED
 *      for stay planning (weekends omitted from a weekdays-only map = closed
 *      those days). This is intentionally stricter than `openStatus` / live
 *      `isOpenNow`, which treat a missing *today* as unknown / "hours not
 *      listed" rather than fabricating "closed now".
 *    - day key present but its tuple is blank/malformed → that day is
 *      UNKNOWN (never-fabricate — never coerced to open or closed)
 *    - day key present with a parseable tuple → that day is OPEN, regardless
 *      of how narrow the window is (openDuringStay answers "is the gym open
 *      at all that day", not "for how long") */
export function openDuringStay(
  hours: HoursMap | null,
  startDate: string,
  endDate: string,
): StayOpenTally {
  if (!hours) return { openDays: 0, closedDays: 0, unknown: true };

  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const cursor = new Date(sy, sm - 1, sd);
  const last = new Date(ey, em - 1, ed);

  if (hours.open_24h) {
    let days = 0;
    while (cursor.getTime() <= last.getTime()) {
      days += 1;
      cursor.setDate(cursor.getDate() + 1);
    }
    return { openDays: days, closedDays: 0, unknown: false };
  }

  const hasAnyDay = DAY_KEYS.some((k) => hours[k]);
  if (!hasAnyDay) return { openDays: 0, closedDays: 0, unknown: true };

  // Mirrors toMins' blank/malformed check (scorer.ts, ~line 45) without
  // extracting it — same regex, same "blank ≠ 0" reasoning, kept local so
  // this addition can't perturb isOpenNow's already-tested behavior.
  const isValidTimeToken = (t: string): boolean => /^\d{1,2}(:\d{1,2})?$/.test((t ?? "").trim());

  let openDays = 0;
  let closedDays = 0;
  let unknown = false;
  while (cursor.getTime() <= last.getTime()) {
    const key = DAY_KEYS[cursor.getDay()];
    const range = hours[key];
    if (!range) {
      closedDays += 1;
    } else {
      const [open, close] = range;
      if (isValidTimeToken(open) && isValidTimeToken(close)) {
        openDays += 1;
      } else {
        unknown = true;
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return { openDays, closedDays, unknown };
}

/** Browse-order tiebreak once matchScore is equal (or absent, i.e. unfiltered
 *  browsing): completeness desc (rich-tier listings surface first) → rating
 *  desc with nulls last → name asc. Without this, gyms.rating is NULL for
 *  every seeded row, so ordering degenerated to alphabetical and buried the
 *  richly-filled gyms behind e.g. "10th Planet Jiu Jitsu". */
function byCompletenessThenRatingThenName(a: EnrichedGym, b: EnrichedGym): number {
  const dc = completeness(b) - completeness(a);
  if (dc !== 0) return dc;
  return byRatingThenName(a, b);
}

function byRatingThenName(a: EnrichedGym, b: EnrichedGym): number {
  const ra = a.rating ?? -1;
  const rb = b.rating ?? -1;
  if (rb !== ra) return rb - ra;
  return a.name.localeCompare(b.name);
}
