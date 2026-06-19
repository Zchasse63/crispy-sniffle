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
    status: "active",
    vibe_tags: [],
    drop_in_policy: null,
    drop_in_note: null,
    monthly_from: null,
    monthly_note: null,
    enrollment_fee: null,
    annual_fee: null,
    annual_fee_label: null,
    single_class_price: null,
    class_packs: null,
    intro_offer: null,
    min_commitment_months: null,
    no_contract_option: null,
    early_termination: null,
    cancellation_notice_days: null,
    freeze_policy: null,
    membership_plans: null,
    student_discount: null,
    military_discount: null,
    senior_discount: null,
    corporate_discount: null,
    family_plans: null,
    guest_policy_model: null,
    app_required_entry: null,
    waitlist: null,
    members_guest_note: null,
    pricing_notes: null,
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
