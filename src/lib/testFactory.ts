/**
 * Test-only factory for a fully-formed EnrichedGym. Not imported by app code
 * (it lives outside the route graph and is only referenced from *.test.ts).
 */
import type {
  AmenityKey,
  EnrichedGym,
  GymAmenityRecord,
  GymEquipmentRecord,
  HoursMap,
} from "@/lib/types/scout";

let n = 0;

export function amenity(key: AmenityKey, over: Partial<GymAmenityRecord> = {}): GymAmenityRecord {
  return { amenity_key: key, present: true, source: "scraped", confidence: 0.85, detail: null, ...over };
}

export function equipment(
  key: GymEquipmentRecord["equipment_key"],
  over: Partial<GymEquipmentRecord> = {},
): GymEquipmentRecord {
  return {
    equipment_key: key,
    brand: null,
    quantity: null,
    max_weight_lbs: null,
    source: "scraped",
    confidence: 0.85,
    detail: null,
    ...over,
  };
}

export function makeGym(over: Partial<EnrichedGym> = {}): EnrichedGym {
  n += 1;
  return {
    id: `gym-${n}`,
    slug: `gym-${n}`,
    city_id: "tampa",
    name: `Gym ${n}`,
    neighborhood: "South Tampa",
    address: "1 Test St",
    lat: 27.95,
    lng: -82.46,
    description: null,
    segment: "strength",
    day_pass_price: null,
    week_pass_price: null,
    hours: null,
    open_24h: false,
    website: null,
    phone: null,
    photo_url: null,
    rating: null,
    rating_count: 0,
    rating_is_seed: true,
    verified: false,
    vibe_tags: [],
    drop_in_policy: null,
    drop_in_note: null,
    monthly_from: null,
    monthly_note: null,
    amenities: [],
    equipment: [],
    parking: [],
    transit: [],
    ...over,
  };
}

export function hours(map: HoursMap): HoursMap {
  return map;
}
