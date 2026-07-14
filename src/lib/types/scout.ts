/**
 * Scout domain types.
 *
 * FilterSet is THE shared contract between:
 *   1. FilterRail UI state        (stores/filterStore.ts)
 *   2. NL fallback parser output  (lib/search/nlParser.ts)
 *   3. ai-search edge function    (supabase/functions/ai-search)
 *   4. Scoring engine input       (lib/scoring/scorer.ts)
 *
 * Any change here must be applied to ALL FOUR simultaneously.
 */
import type { Database } from "./database";

export type GymSegment = Database["public"]["Enums"]["gym_segment"];
export type EquipmentKey = Database["public"]["Enums"]["equipment_key"];

export type AmenityKey =
  | "sauna"
  | "cold_plunge"
  | "steam_room"
  | "pool"
  | "recovery_room"
  | "open_24h"
  | "classes"
  | "personal_training"
  | "turf_area"
  | "cardio_zone"
  | "basketball_court"
  | "day_pass"
  | "parking"
  | "lockers"
  | "showers"
  | "towel_service"
  | "wifi"
  | "juice_bar"
  | "childcare"
  | "cafe"
  | "coworking_space"
  | "womens_area"
  | "womens_only"
  | "tanning"
  | "hydromassage"
  | "spin_studio"
  | "retail_shop"
  | "props_provided"
  | "open_gym"
  | "chalk_allowed"
  | "wheelchair_accessible"
  | "accessible_restrooms";

export type ProvenanceSource =
  | "owner"
  | "scout_verified"
  | "user"
  | "scraped"
  | "seed"
  | "estimated"
  | "osm"
  | "city_data";

export interface FilterSet {
  amenities: AmenityKey[];
  equipment: {
    keys: EquipmentKey[];
    minSquatRacks: number | null;
    minDumbbellWeight: number | null;
    brands: string[];
  };
  maxDayPass: number | null;
  openNow: boolean;
  open24h: boolean;
  neighborhood: string | null;
  /** HARD facility-type filter — set ONLY by explicit user action (rail chips). */
  segments: GymSegment[];
  /** SOFT facility-type preference — set by AI/NL parsing. Scored, never excludes.
   *  Principle: segment labels are vibes, equipment is ground truth — a yoga
   *  studio with a cold plunge is not a lifting gym (the Kodawari rule). */
  preferredSegments: GymSegment[];
  /** SOFT vibe preference — set by AI/NL parsing ("trendy", "vibey"…).
   *  Scored, never excludes. */
  preferredVibes: VibeTag[];
  /** Raw user text, preserved for reason generation + analytics. */
  rawQuery: string;
}

export const EMPTY_FILTER_SET: FilterSet = {
  amenities: [],
  equipment: { keys: [], minSquatRacks: null, minDumbbellWeight: null, brands: [] },
  maxDayPass: null,
  openNow: false,
  open24h: false,
  neighborhood: null,
  segments: [],
  preferredSegments: [],
  preferredVibes: [],
  rawQuery: "",
};

/** Equipment that DEFINES a facility's training capability per segment.
 *  Used to translate activity intent into ground-truth requirements. */
export const SEGMENT_CAPABILITIES: Partial<Record<GymSegment, EquipmentKey[]>> = {
  strength: ["squat_rack", "barbells", "dumbbells"],
  crossfit: ["platform", "pull_up_bar"],
  climbing: ["climbing_wall"],
  cycling: ["spin_bike"],
};

export function isEmptyFilterSet(f: FilterSet): boolean {
  return (
    f.amenities.length === 0 &&
    f.equipment.keys.length === 0 &&
    f.equipment.minSquatRacks === null &&
    f.equipment.minDumbbellWeight === null &&
    f.equipment.brands.length === 0 &&
    f.maxDayPass === null &&
    !f.openNow &&
    !f.open24h &&
    f.neighborhood === null &&
    f.segments.length === 0 &&
    f.preferredSegments.length === 0 &&
    f.preferredVibes.length === 0
  );
}

/** Count of active FilterSet members (+1 for travel, if active) for the
 *  mobile Filters-button badge. Kept LOCKSTEP with isEmptyFilterSet above —
 *  every member that function checks must have a matching increment here
 *  (rawQuery excluded from both: it's metadata, not a filter). Travel lives
 *  outside FilterSet (see stores/filterStore.ts), hence the separate param. */
export function countActiveFilters(f: FilterSet, travelActive: boolean): number {
  let n = 0;
  n += f.amenities.length;
  n += f.equipment.keys.length;
  if (f.equipment.minSquatRacks !== null) n++;
  if (f.equipment.minDumbbellWeight !== null) n++;
  n += f.equipment.brands.length;
  if (f.maxDayPass !== null) n++;
  if (f.openNow) n++;
  if (f.open24h) n++;
  if (f.neighborhood !== null) n++;
  n += f.segments.length;
  n += f.preferredSegments.length;
  n += f.preferredVibes.length;
  if (travelActive) n++;
  return n;
}

export interface GymAmenityRecord {
  amenity_key: AmenityKey;
  present: boolean;
  source: ProvenanceSource;
  confidence: number;
  detail: string | null;
}

export interface GymEquipmentRecord {
  equipment_key: EquipmentKey;
  brand: string | null;
  quantity: number | null;
  max_weight_lbs: number | null;
  source: ProvenanceSource;
  confidence: number;
  detail: string | null;
}

export interface HoursMap {
  open_24h?: boolean;
  mon?: [string, string];
  tue?: [string, string];
  wed?: [string, string];
  thu?: [string, string];
  fri?: [string, string];
  sat?: [string, string];
  sun?: [string, string];
}

/* ── Pricing / membership model (docs/research/pricing-model.md) ───── */

/** Commitment term — the price DIMENSION (longer term usually cheaper). */
export type CommitmentTerm =
  | "month_to_month"
  | "3_month"
  | "6_month"
  | "12_month"
  | "paid_in_full";

export type MembershipUsageType =
  | "unlimited"
  | "visits_per_month"
  | "visits_per_week"
  | "classes_per_month";

/** One membership plan/tier and its price across commitment terms. */
export interface MembershipPlan {
  name: string;
  usage: { type: MembershipUsageType; count?: number | null } | null;
  scope?: "single_club" | "multi_club" | null;
  hours?: "all" | "off_peak" | null;
  includes?: string[];
  prices: { term: CommitmentTerm; monthly: number | null; paid_total?: number | null }[];
  notes?: string | null;
}

export type EarlyTerminationType =
  | "buyout_remaining"
  | "flat_fee"
  | "months_dues"
  | "notice_only"
  | "none";

export interface EarlyTermination {
  type: EarlyTerminationType;
  amount?: number | null;
  note?: string | null;
}

export interface ClassPack {
  count: number;
  price: number;
}

/** Life Time-style guest/access models (see docs/research/lifetime-research.md). */
export type GuestPolicyModel =
  | "public_day_pass"
  | "member_invite_only"
  | "members_only_waitlist"
  | "hybrid";

export const GUEST_POLICY_LABELS: Record<GuestPolicyModel, string> = {
  public_day_pass: "Public day pass",
  member_invite_only: "Members' guests only",
  members_only_waitlist: "Members only (waitlist)",
  hybrid: "Day pass + members",
};

/** A gym with amenities + equipment joined (assembled by lib/queries/gyms.ts). */
export interface EnrichedGym {
  id: string;
  slug: string;
  city_id: string;
  name: string;
  neighborhood: string | null;
  address: string | null;
  lat: number | null;
  lng: number | null;
  description: string | null;
  segment: GymSegment | null;
  day_pass_price: number | null;
  week_pass_price: number | null;
  hours: HoursMap | null;
  open_24h: boolean;
  website: string | null;
  phone: string | null;
  instagram: string | null;
  photo_url: string | null;
  // Raw Storage path for the hero photo, so a surface can request a per-surface
  // width via gymPhotoUrl (photo_url is resolved at a default width).
  photo_storage_path: string | null;
  rating: number | null;
  rating_count: number;
  /** True until the first Scout community review replaces the seeded web rating. */
  rating_is_seed: boolean;
  verified: boolean;
  /** Catalog lifecycle — public surfaces hide/relabel non-active gyms. */
  status: GymStatus;
  vibe_tags: VibeTag[];
  drop_in_policy: DropInPolicy | null;
  drop_in_note: string | null;
  monthly_from: number | null;
  monthly_note: string | null;
  /* Pricing / membership / fees / access — see docs/research/pricing-model.md.
   * All nullable: unknown stays "unlisted" (never-fabricate). */
  enrollment_fee: number | null;
  annual_fee: number | null;
  annual_fee_label: string | null;
  single_class_price: number | null;
  class_packs: ClassPack[] | null;
  intro_offer: string | null;
  min_commitment_months: number | null;
  no_contract_option: boolean | null;
  early_termination: EarlyTermination | null;
  cancellation_notice_days: number | null;
  freeze_policy: string | null;
  membership_plans: MembershipPlan[] | null;
  student_discount: boolean | null;
  military_discount: boolean | null;
  senior_discount: boolean | null;
  corporate_discount: boolean | null;
  family_plans: boolean | null;
  guest_policy_model: GuestPolicyModel | null;
  app_required_entry: boolean | null;
  waitlist: boolean | null;
  members_guest_note: string | null;
  pricing_notes: string | null;
  amenities: GymAmenityRecord[];
  equipment: GymEquipmentRecord[];
  parking: GymParkingRecord[];
  transit: GymTransitRecord[];
}

/** Output of the deterministic scoring engine. */
export interface ScoredGym extends EnrichedGym {
  /** 0–100 when a FilterSet is active; null when browsing unfiltered. */
  matchScore: number | null;
  /** Human-readable reasons, e.g. "Has sauna", "Dumbbells to 150 lbs". */
  matchReasons: string[];
  /** Requested but absent/unknown, e.g. "No cold plunge listed". */
  missingItems: string[];
}

export interface City {
  id: string;
  slug: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
  tier: "rich" | "basic";
  /** Publicly browsable metro. False = placeholder/pre-enrichment (never
   *  expose in the city switcher or landing pages); Miami flips true only
   *  after its dedicated enrichment pass. */
  is_live: boolean;
}

export interface Trip {
  id: string; // crypto.randomUUID() client-side
  citySlug: string;
  cityName: string;
  startDate: string; // YYYY-MM-DD
  endDate: string; // YYYY-MM-DD
  createdAt: string; // ISO timestamp
  /** Where you're staying — unlocks drive-time ranking of destination gyms. */
  lodging?: { label: string; lng: number; lat: number } | null;
}

/** Single source for amenity display labels (was duplicated in 3 files). */
export const AMENITY_LABELS: Record<AmenityKey, string> = {
  sauna: "Sauna",
  cold_plunge: "Cold Plunge",
  steam_room: "Steam Room",
  pool: "Pool",
  recovery_room: "Recovery Room",
  open_24h: "24-Hour Access",
  classes: "Group Classes",
  personal_training: "Personal Training",
  turf_area: "Turf Area",
  cardio_zone: "Cardio Zone",
  basketball_court: "Basketball Court",
  day_pass: "Day Passes",
  parking: "Parking",
  lockers: "Locker Rooms",
  showers: "Showers",
  towel_service: "Towel Service",
  wifi: "Wi-Fi",
  juice_bar: "Juice Bar",
  childcare: "Childcare",
  cafe: "Café",
  coworking_space: "Co-working Space",
  womens_area: "Women's-Only Area",
  womens_only: "Women's-Only Gym",
  tanning: "Tanning",
  hydromassage: "Hydromassage",
  spin_studio: "Cycling Studio",
  retail_shop: "Retail / Pro Shop",
  props_provided: "Props Provided",
  open_gym: "Open Gym Access",
  chalk_allowed: "Chalk Allowed",
  wheelchair_accessible: "Wheelchair Accessible",
  accessible_restrooms: "Accessible Restrooms",
};

export const SEGMENT_LABELS: Record<GymSegment, string> = {
  strength: "Strength & Powerlifting",
  crossfit: "CrossFit",
  big_box: "Big Box",
  boutique: "Boutique Studio",
  climbing: "Climbing",
  yoga_pilates: "Yoga & Pilates",
  mma: "MMA & Boxing",
  recovery: "Recovery",
  luxury: "Luxury Club",
  cycling: "Cycling / Spin",
  barre: "Barre",
};

/** Vibe taxonomy — SOFT matching signals only (Kodawari rule: vibes boost,
 *  never exclude). Assigned at the estimated tier until vision/community
 *  confirm. */
export const VIBE_TAGS = [
  "trendy",
  "aesthetic",
  "social",
  "serene",
  "old_school",
  "no_frills",
  "hardcore",
  "community",
  "beginner_friendly",
] as const;
export type VibeTag = (typeof VIBE_TAGS)[number];
export const VIBE_LABELS: Record<VibeTag, string> = {
  trendy: "Trendy",
  aesthetic: "Aesthetic",
  social: "Social",
  serene: "Serene",
  old_school: "Old school",
  no_frills: "No frills",
  hardcore: "Hardcore",
  community: "Community-first",
  beginner_friendly: "Beginner friendly",
};

export const EQUIPMENT_LABELS: Record<EquipmentKey, string> = {
  squat_rack: "Squat Racks",
  power_rack: "Power Racks",
  platform: "Lifting Platforms",
  dumbbells: "Dumbbells",
  barbells: "Barbells",
  kettlebells: "Kettlebells",
  ghd: "GHD",
  sled: "Sled / Prowler",
  ski_erg: "Ski Erg",
  assault_bike: "Assault Bike",
  rower: "Rowing Machines",
  reverse_hyper: "Reverse Hyper",
  belt_squat: "Belt Squat",
  comp_bench: "Competition Bench",
  cable_machine: "Cable Machines",
  leg_press: "Leg Press",
  smith_machine: "Smith Machine",
  hack_squat: "Hack Squat",
  pull_up_bar: "Pull-up Bars",
  dip_station: "Dip Station",
  monolift: "Monolift",
  climbing_wall: "Climbing Wall",
  hip_thrust: "Hip Thrust Machine",
  leg_extension: "Leg Extension",
  leg_curl: "Leg Curl",
  abductor_adductor: "Abductor / Adductor",
  calf_machine: "Calf Machine",
  stepmill: "Stepmill",
  specialty_bars: "Specialty Bars",
  nordic_bench: "Nordic Bench",
  treadmill: "Treadmills",
  elliptical: "Ellipticals",
  upright_bike: "Upright Bikes",
  recumbent_bike: "Recumbent Bikes",
  stair_climber: "Stair Climbers",
  reformer: "Reformers",
  pilates_tower: "Pilates Tower",
  cadillac: "Cadillac / Trapeze Table",
  pilates_chair: "Pilates Chair",
  pilates_barrel: "Pilates Barrel",
  aerial_rig: "Aerial Rig",
  heavy_bag: "Heavy Bags",
  boxing_ring: "Boxing Ring",
  mma_cage: "MMA Cage",
  mats: "Mat Space",
  spin_bike: "Spin Bikes",
  curved_treadmill: "Curved Manual Treadmill",
  versaclimber: "VersaClimber",
  jacobs_ladder: "Jacobs Ladder",
  arc_trainer: "Arc Trainer",
  incline_trainer: "Incline Trainer",
  water_rower: "Water Rower",
  recumbent_stepper: "Recumbent Stepper",
  upper_body_ergometer: "Upper Body Ergometer",
  chest_press_machine: "Chest Press Machine",
  shoulder_press_machine: "Shoulder Press Machine",
  lat_pulldown_machine: "Lat Pulldown Machine",
  seated_row_machine: "Seated Row Machine",
  pec_deck: "Pec Deck / Chest Fly Machine",
  rear_delt_machine: "Rear Delt Machine",
  lateral_raise_machine: "Lateral Raise Machine",
  preacher_curl_machine: "Preacher Curl Machine",
  tricep_extension_machine: "Tricep Extension Machine",
  tricep_pushdown_machine: "Tricep Pushdown Machine",
  assisted_pull_up_dip_machine: "Assisted Pull-Up / Dip Machine",
  ab_crunch_machine: "Ab Crunch Machine",
  back_extension_machine: "Back Extension Machine",
  torso_rotation_machine: "Torso Rotation Machine",
  glute_machine: "Glute Machine",
  lat_pullover_machine: "Lat Pullover Machine",
  cable_crossover: "Cable Crossover / Functional Trainer",
  iso_lateral_chest_press: "Iso-Lateral Chest Press",
  iso_lateral_incline_press: "Iso-Lateral Incline Press",
  iso_lateral_shoulder_press: "Iso-Lateral Shoulder Press",
  iso_lateral_row: "Iso-Lateral Row",
  iso_lateral_pulldown: "Iso-Lateral Pulldown",
  t_bar_row_machine: "T-Bar Row Machine",
  pendulum_squat: "Pendulum Squat",
  v_squat: "V-Squat",
  linear_leg_press: "Linear (45°) Leg Press",
  seated_dip_machine: "Seated Dip Machine",
  landmine_station: "Landmine Station",
  adjustable_bench: "Adjustable Bench",
  flat_bench: "Flat Bench",
  incline_bench: "Incline Bench",
  decline_bench: "Decline Bench",
  preacher_bench: "Preacher Bench",
  adjustable_dumbbells: "Adjustable Dumbbells",
  bumper_plates: "Bumper Plates",
  weight_plates: "Iron Weight Plates",
  change_plates: "Fractional / Change Plates",
  trap_bar: "Trap / Hex Bar",
  ez_curl_bar: "EZ Curl Bar",
  safety_squat_bar: "Safety Squat Bar",
  swiss_bar: "Swiss / Football Bar",
  fat_grip_bar: "Fat / Axle Bar",
  half_rack: "Half Rack",
  wall_mounted_rack: "Wall-Mounted Rack",
  deadlift_jack: "Deadlift Jack",
  resistance_bands: "Resistance Bands",
  jerk_blocks: "Jerk / Pulling Blocks",
  battle_ropes: "Battle Ropes",
  plyo_boxes: "Plyo Boxes",
  medicine_balls: "Medicine Balls",
  slam_balls: "Slam Balls",
  wall_balls: "Wall Balls",
  suspension_trainer: "Suspension Trainer (TRX)",
  gymnastic_rings: "Gymnastic Rings",
  parallettes: "Parallettes",
  climbing_rope: "Climbing Rope",
  jump_ropes: "Jump Ropes",
  agility_ladder: "Agility Ladder",
  ab_wheel: "Ab Wheel",
  weighted_vest: "Weighted Vest",
  sandbags: "Sandbags",
  tires: "Tire (Tire Flip)",
  atlas_stones: "Atlas Stones",
  yoke: "Yoke",
  farmers_handles: "Farmers Carry Handles",
  log_bar: "Log Bar",
  balance_trainer: "Balance Trainer (BOSU)",
  stability_ball: "Stability Ball",
  vibration_plate: "Vibration Plate",
  ballet_barre: "Ballet Barre",
  spring_wall: "Spring Wall",
  magic_circle: "Magic Circle",
  spine_corrector: "Spine Corrector",
  jump_board: "Reformer Jump Board",
  yoga_blocks: "Yoga Blocks",
  yoga_straps: "Yoga Straps",
  yoga_bolsters: "Yoga Bolsters",
  yoga_wheel: "Yoga Wheel",
  yoga_swing: "Yoga Swing",
  pilates_mat: "Pilates Mat",
  toning_balls: "Pilates / Barre Toning Balls",
  balance_pad: "Balance Pad",
  balance_board: "Balance Board",
  ankle_weights: "Ankle / Wrist Weights",
  foam_roller: "Foam Roller",
  speed_bag: "Speed Bag",
  double_end_bag: "Double-End Bag",
  muay_thai_bag: "Muay Thai Bag",
  uppercut_bag: "Uppercut / Angle Bag",
  free_standing_bag: "Free-Standing Bag",
  body_opponent_bag: "Body Opponent Bag (BOB)",
  reflex_bag: "Reflex / Cobra Bag",
  aqua_bag: "Aqua Bag",
  grappling_dummy: "Grappling Dummy",
  wing_chun_dummy: "Wing Chun Wooden Dummy",
  focus_mitts_area: "Pad Work / Focus Mitts Area",
  normatec_boots: "Compression Boots (NormaTec)",
  massage_gun: "Percussion Massage Gun",
  stretching_station: "Stretching Cage / Mobility Station",
  inversion_table: "Inversion Table",
};

/** Machine-level keys — the premium granularity surface ("Pro preview"). */
export const MACHINE_KEYS: EquipmentKey[] = [
  "hip_thrust",
  "leg_extension",
  "leg_curl",
  "abductor_adductor",
  "calf_machine",
  "hack_squat",
  "leg_press",
  "smith_machine",
  "cable_machine",
  "chest_press_machine",
  "shoulder_press_machine",
  "lat_pulldown_machine",
  "seated_row_machine",
  "pec_deck",
  "rear_delt_machine",
  "lateral_raise_machine",
  "preacher_curl_machine",
  "tricep_extension_machine",
  "tricep_pushdown_machine",
  "assisted_pull_up_dip_machine",
  "ab_crunch_machine",
  "back_extension_machine",
  "torso_rotation_machine",
  "glute_machine",
  "lat_pullover_machine",
  "cable_crossover",
  "iso_lateral_chest_press",
  "iso_lateral_incline_press",
  "iso_lateral_shoulder_press",
  "iso_lateral_row",
  "iso_lateral_pulldown",
  "t_bar_row_machine",
  "pendulum_squat",
  "v_squat",
  "linear_leg_press",
  "seated_dip_machine",
  "landmine_station",
];

export const PROVENANCE_META: Record<
  ProvenanceSource,
  { label: string; rank: number }
> = {
  owner: { label: "Owner Listed", rank: 6 },
  scout_verified: { label: "Scout Verified", rank: 5 },
  user: { label: "User Confirmed", rank: 4 },
  scraped: { label: "Web Data", rank: 3 },
  seed: { label: "Scout Data", rank: 2 },
  osm: { label: "OpenStreetMap", rank: 2 },
  city_data: { label: "City Open Data", rank: 2 },
  estimated: { label: "Estimated", rank: 1 },
};

/* ── Instagram ────────────────────────────────────────────────────── */

/** Normalize any Instagram input (handle, @handle, or profile URL) to a bare
 *  handle, or null if it isn't a valid handle. */
export function normalizeInstagramHandle(input: string | null | undefined): string | null {
  if (!input) return null;
  let s = input.trim();
  if (!s) return null;
  s = s
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/^(instagram\.com|instagr\.am)\//i, "")
    .replace(/^@/, "")
    .replace(/[/?#].*$/, "")
    .trim();
  return /^[A-Za-z0-9._]{1,30}$/.test(s) ? s : null;
}

/** Public profile URL for a stored Instagram value, or null. */
export function instagramUrl(input: string | null | undefined): string | null {
  const handle = normalizeInstagramHandle(input);
  return handle ? `https://instagram.com/${handle}` : null;
}

/* ── Catalog lifecycle ────────────────────────────────────────────── */

export type GymStatus =
  | "active"
  | "suspect"
  | "closed"
  | "moved"
  | "duplicate"
  | "unverified_new";

export const GYM_STATUS_LABELS: Record<GymStatus, string> = {
  active: "Active",
  suspect: "Suspect",
  closed: "Closed",
  moved: "Moved",
  duplicate: "Duplicate",
  unverified_new: "Unverified — new",
};

/** Statuses hidden from public discovery surfaces (closed/relocated/deduped). */
export const PUBLIC_HIDDEN_STATUSES: GymStatus[] = ["closed", "moved", "duplicate"];

/* ── Decision intelligence ────────────────────────────────────────── */

export type DropInPolicy =
  | "walk_in"
  | "book_first"
  | "restricted"
  | "trial_route"
  | "membership_only";

export const DROP_IN_LABELS: Record<DropInPolicy, string> = {
  walk_in: "Walk in",
  book_first: "Book first",
  restricted: "Restricted drop-in",
  trial_route: "Free trial route",
  membership_only: "Members only",
};

export interface GymTransitRecord {
  id: string;
  kind: "bike_rack" | "bus_stop" | "rail_station";
  name: string | null;
  distance_m: number | null;
  source: ProvenanceSource;
  confidence: number;
  detail: string | null;
}

/* ── Parking intelligence ─────────────────────────────────────────── */

export type ParkingKind =
  | "onsite_lot"
  | "onsite_garage"
  | "nearby_lot"
  | "nearby_garage"
  | "street"
  | "valet";

export type ParkingAccess =
  | "free"
  | "customers"
  | "validated"
  | "paid"
  | "permit"
  | "unknown";

export interface GymParkingRecord {
  id: string;
  gym_id: string;
  kind: ParkingKind;
  name: string | null;
  distance_m: number | null;
  access: ParkingAccess;
  fee_detail: string | null;
  capacity: number | null;
  lat: number | null;
  lng: number | null;
  is_primary: boolean;
  source: ProvenanceSource;
  confidence: number;
  detail: string | null;
}
