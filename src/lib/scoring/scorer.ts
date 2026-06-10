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
  EMPTY_FILTER_SET,
  EQUIPMENT_LABELS,
  isEmptyFilterSet,
  type AmenityKey,
  type EnrichedGym,
  type FilterSet,
  type HoursMap,
  type ScoredGym,
} from "@/lib/types/scout";

const AMENITY_LABELS: Record<AmenityKey, string> = {
  sauna: "Sauna",
  cold_plunge: "Cold plunge",
  steam_room: "Steam room",
  pool: "Pool",
  recovery_room: "Recovery room",
  open_24h: "24-hour access",
  classes: "Group classes",
  personal_training: "Personal training",
  turf_area: "Turf area",
  cardio_zone: "Cardio zone",
  basketball_court: "Basketball court",
  day_pass: "Day passes",
  parking: "Parking",
  lockers: "Lockers",
  showers: "Showers",
  towel_service: "Towel service",
  wifi: "Wi-Fi",
  juice_bar: "Juice bar",
  childcare: "Childcare",
};

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

export function isOpenNow(hours: HoursMap | null, now: Date = new Date()): boolean | null {
  if (!hours) return null; // unknown
  if (hours.open_24h) return true;
  const day = DAY_KEYS[now.getDay()];
  const range = hours[day];
  if (!range) return null; // unknown for today
  const [open, close] = range;
  const mins = now.getHours() * 60 + now.getMinutes();
  const toMins = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return h * 60 + (m || 0);
  };
  const o = toMins(open);
  const c = toMins(close);
  if (c <= o) return mins >= o || mins < c; // overnight range
  return mins >= o && mins < c;
}

function hasAmenity(gym: EnrichedGym, key: AmenityKey): boolean {
  if (key === "open_24h" && gym.open_24h) return true;
  return gym.amenities.some((a) => a.amenity_key === key && a.present);
}

export function scoreGyms(
  gyms: EnrichedGym[],
  filters: FilterSet = EMPTY_FILTER_SET,
  now: Date = new Date(),
): ScoredGym[] {
  if (isEmptyFilterSet(filters)) {
    return [...gyms]
      .sort(byRatingThenName)
      .map((gym) => ({ ...gym, matchScore: null, matchReasons: [], missingItems: [] }));
  }

  // ── hard filters (exclusions) ────────────────────────────────────
  let pool = gyms.filter((gym) => {
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
    if (filters.open24h && !gym.open_24h) return false;
    if (filters.openNow) {
      const open = gym.open_24h || isOpenNow(gym.hours, now);
      if (open === false) return false; // unknown hours pass through with a note
    }
    if (
      filters.maxDayPass !== null &&
      gym.day_pass_price !== null &&
      gym.day_pass_price > filters.maxDayPass
    )
      return false;
    return true;
  });

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
          reasons.push(`Has ${AMENITY_LABELS[key].toLowerCase()}`);
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
          const label = EQUIPMENT_LABELS[key];
          reasons.push(
            rec.quantity && rec.quantity > 1
              ? `${rec.quantity}× ${label.toLowerCase()}`
              : `Has ${label.toLowerCase()}`,
          );
        } else {
          missing.push(`No ${EQUIPMENT_LABELS[key].toLowerCase()} listed`);
        }
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
      if (filters.open24h && gym.open_24h) {
        earned += 5;
        reasons.push("Open 24 hours");
      } else if (filters.openNow) {
        const open = gym.open_24h || isOpenNow(gym.hours, now);
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
    return byRatingThenName(a, b);
  });
}

function byRatingThenName(a: EnrichedGym, b: EnrichedGym): number {
  const ra = a.rating ?? -1;
  const rb = b.rating ?? -1;
  if (rb !== ra) return rb - ra;
  return a.name.localeCompare(b.name);
}
