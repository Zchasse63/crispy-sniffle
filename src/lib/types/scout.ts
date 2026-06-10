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
  | "childcare";

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
  photo_url: string | null;
  rating: number | null;
  rating_count: number;
  verified: boolean;
  vibe_tags: VibeTag[];
  drop_in_policy: DropInPolicy | null;
  drop_in_note: string | null;
  monthly_from: number | null;
  monthly_note: string | null;
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
};

export const PROVENANCE_META: Record<
  ProvenanceSource,
  { label: string; rank: number }
> = {
  owner: { label: "Owner Listed", rank: 5 },
  scout_verified: { label: "Scout Verified", rank: 6 },
  user: { label: "User Confirmed", rank: 4 },
  scraped: { label: "Web Data", rank: 3 },
  seed: { label: "Scout Data", rank: 2 },
  osm: { label: "OpenStreetMap", rank: 2 },
  city_data: { label: "City Open Data", rank: 2 },
  estimated: { label: "Estimated", rank: 1 },
};

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
