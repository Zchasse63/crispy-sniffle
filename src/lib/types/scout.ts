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
  | "estimated";

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
  segments: GymSegment[];
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
  rawQuery: "",
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
    f.segments.length === 0
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
  amenities: GymAmenityRecord[];
  equipment: GymEquipmentRecord[];
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
  estimated: { label: "Estimated", rank: 1 },
};
