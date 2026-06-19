/**
 * Owner-form structure as DATA — sections, fields, options, branch rules.
 * Iterating on the form = editing this file, not JSX.
 *
 * All option labels are REUSED from src/lib/types/scout.ts (CLAUDE.md rule 5).
 * The only label maps defined here are parking kind/access, which scout.ts
 * does not export (form-only display strings, no shared map to duplicate).
 */
import type { AnswerMap } from "./answerTypes";
import {
  AMENITY_LABELS,
  DROP_IN_LABELS,
  EQUIPMENT_LABELS,
  GUEST_POLICY_LABELS,
  MACHINE_KEYS,
  SEGMENT_LABELS,
  VIBE_LABELS,
  type AmenityKey,
  type EquipmentKey,
  type GuestPolicyModel,
  type GymSegment,
  type ParkingAccess,
  type ParkingKind,
} from "@/lib/types/scout";

export type FieldType =
  | "chip-multi"
  | "chip-single"
  | "tri-state"
  | "stepper"
  | "currency"
  | "text"
  | "text-voice"
  | "hours-grid"
  | "membership-plans"
  | "photo-stub";

/** Equipment branch a segment maps to (segment-tailored equipment questions). */
export type EquipmentBranch =
  | "strength_full" // strength, big_box, luxury
  | "conditioning" // crossfit
  | "combat" // mma — bags/ring/cage + conditioning
  | "pilates_full" // yoga_pilates — reformers + apparatus
  | "yoga_toggle" // recovery — light strength toggle
  | "climbing_full" // climbing
  | "cycling_full" // cycling/spin
  | "barre_min" // barre
  | "boutique_min"; // boutique

export const EQUIPMENT_BRANCH_MAP: Record<GymSegment, EquipmentBranch> = {
  strength: "strength_full",
  big_box: "strength_full",
  luxury: "strength_full",
  crossfit: "conditioning",
  mma: "combat",
  yoga_pilates: "pilates_full",
  recovery: "yoga_toggle",
  climbing: "climbing_full",
  boutique: "boutique_min",
  cycling: "cycling_full",
  barre: "barre_min",
};

export interface FieldOption {
  key: string;
  label: string;
}

export interface FieldDef {
  id: string;
  type: FieldType;
  label: string;
  hint?: string;
  options?: FieldOption[];
  /** stepper bounds / unit */
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  /** chip-multi selection cap (e.g. vibes max 3) */
  maxSelect?: number;
  /** placeholder for text / currency */
  placeholder?: string;
  /** larger textarea (the voice-note dump) */
  large?: boolean;
  /** text input semantics → mobile keyboard + light validation */
  format?: "tel" | "url" | "email";
  /** section E only: render only when the gym's branch is in this list */
  branches?: EquipmentBranch[];
  /** conditional render based on other answers (B2 hidden when 24h, etc.) */
  showIf?: (a: AnswerMap) => boolean;
  /** mark fields whose options are EquipmentKeys (used by prefill) */
  equipmentField?: boolean;
}

export interface FormSection {
  id: string;
  label: string;
  intro?: string;
  path: "short" | "full";
  fields: FieldDef[];
}

/* ── option helpers ─────────────────────────────────────────────────── */
const eqOpts = (keys: EquipmentKey[]): FieldOption[] =>
  keys.map((k) => ({ key: k, label: EQUIPMENT_LABELS[k] }));

const segOpts: FieldOption[] = (Object.keys(SEGMENT_LABELS) as GymSegment[]).map(
  (k) => ({ key: k, label: SEGMENT_LABELS[k] }),
);

const dropInOpts: FieldOption[] = (
  Object.keys(DROP_IN_LABELS) as Array<keyof typeof DROP_IN_LABELS>
).map((k) => ({ key: k, label: DROP_IN_LABELS[k] }));

const vibeOpts: FieldOption[] = (
  Object.keys(VIBE_LABELS) as Array<keyof typeof VIBE_LABELS>
).map((k) => ({ key: k, label: VIBE_LABELS[k] }));

/** Amenities shown in section D — excludes ones with dedicated questions
 *  (women's → G, day_pass → derived from pricing, parking → F, 24h → hours). */
const D_EXCLUDE: AmenityKey[] = [
  "womens_area",
  "womens_only",
  "day_pass",
  "parking",
  "open_24h",
  // accessibility gets its own clear question (section G)
  "wheelchair_accessible",
  "accessible_restrooms",
];
const amenityOpts: FieldOption[] = (Object.keys(AMENITY_LABELS) as AmenityKey[])
  .filter((k) => !D_EXCLUDE.includes(k))
  .map((k) => ({ key: k, label: AMENITY_LABELS[k] }));

// Parking display strings — form-only, scout.ts exports no label map for these.
const PARKING_KIND_LABELS: Record<ParkingKind, string> = {
  onsite_lot: "On-site lot",
  onsite_garage: "On-site garage",
  nearby_lot: "Nearby lot",
  nearby_garage: "Nearby garage",
  street: "Street parking",
  valet: "Valet",
};
const PARKING_ACCESS_LABELS: Record<ParkingAccess, string> = {
  free: "Free",
  customers: "Free for customers",
  validated: "Validated",
  paid: "Paid",
  permit: "Permit",
  unknown: "Not sure",
};
const parkingKindOpts: FieldOption[] = (
  Object.keys(PARKING_KIND_LABELS) as ParkingKind[]
).map((k) => ({ key: k, label: PARKING_KIND_LABELS[k] }));
const parkingAccessOpts: FieldOption[] = (
  Object.keys(PARKING_ACCESS_LABELS) as ParkingAccess[]
).map((k) => ({ key: k, label: PARKING_ACCESS_LABELS[k] }));

const eq = (keys: EquipmentKey[], rest: Omit<FieldDef, "type" | "options" | "equipmentField">): FieldDef => ({
  type: "chip-multi",
  options: eqOpts(keys),
  equipmentField: true,
  ...rest,
});

/* ── pricing option helpers ─────────────────────────────────────────── */
const guestModelOpts: FieldOption[] = (
  Object.keys(GUEST_POLICY_LABELS) as GuestPolicyModel[]
).map((k) => ({ key: k, label: GUEST_POLICY_LABELS[k] }));

const commitmentOpts: FieldOption[] = [
  { key: "month_to_month", label: "Month-to-month" },
  { key: "3_month", label: "3-month" },
  { key: "6_month", label: "6-month" },
  { key: "12_month", label: "Annual (12-month)" },
  { key: "paid_in_full", label: "Paid in full" },
];

const earlyTermOpts: FieldOption[] = [
  { key: "none", label: "Nothing — cancel anytime" },
  { key: "notice_only", label: "Just advance notice" },
  { key: "flat_fee", label: "Flat early-termination fee" },
  { key: "buyout_remaining", label: "Buy out remaining months" },
  { key: "months_dues", label: "A set number of months' dues" },
];

const discountOpts: FieldOption[] = [
  { key: "student", label: "Student" },
  { key: "military", label: "Military / first responder" },
  { key: "senior", label: "Senior" },
  { key: "corporate", label: "Corporate" },
  { key: "family", label: "Family / household" },
];

/** Class-based segments see class economics (single class, packs). */
const CLASS_SEGMENTS: GymSegment[] = ["yoga_pilates", "cycling", "barre", "boutique"];
const pickedSegment = (a: AnswerMap): GymSegment | null =>
  a.a_segment?.kind === "choice" ? (a.a_segment.value as GymSegment | null) : null;
const isClassSegment = (a: AnswerMap): boolean => {
  const seg = pickedSegment(a);
  return seg != null && CLASS_SEGMENTS.includes(seg);
};
const offersContract = (a: AnswerMap): boolean =>
  a.m_commitment?.kind === "chips" &&
  a.m_commitment.value.some((t) => t !== "month_to_month");

/** Major equipment brands for the multiple-choice chips ("other" goes in a note). */
export const BRAND_OPTIONS: FieldOption[] = [
  { key: "rogue", label: "Rogue" },
  { key: "life_fitness", label: "Life Fitness" },
  { key: "hammer_strength", label: "Hammer Strength" },
  { key: "technogym", label: "Technogym" },
  { key: "precor", label: "Precor" },
  { key: "cybex", label: "Cybex" },
  { key: "matrix", label: "Matrix" },
  { key: "nautilus", label: "Nautilus" },
  { key: "eleiko", label: "Eleiko" },
  { key: "peloton", label: "Peloton" },
  { key: "concept2", label: "Concept2" },
  { key: "stairmaster", label: "StairMaster" },
  { key: "star_trac", label: "Star Trac" },
  { key: "woodway", label: "Woodway" },
  { key: "keiser", label: "Keiser" },
  { key: "hoist", label: "Hoist" },
  { key: "body_solid", label: "Body-Solid" },
  { key: "titan_fitness", label: "Titan Fitness" },
  { key: "rep_fitness", label: "Rep Fitness" },
  { key: "force_usa", label: "Force USA" },
  { key: "powerblock", label: "PowerBlock" },
  { key: "trx", label: "TRX" },
  { key: "nordictrack", label: "NordicTrack" },
  { key: "schwinn", label: "Schwinn" },
  { key: "assault_fitness", label: "Assault Fitness" },
  { key: "octane_fitness", label: "Octane Fitness" },
  { key: "spirit_fitness", label: "Spirit Fitness" },
  { key: "atlantis", label: "Atlantis" },
  { key: "gym80", label: "Gym80" },
  { key: "panatta", label: "Panatta" },
  { key: "prime_fitness", label: "Prime Fitness" },
  { key: "arsenal_strength", label: "Arsenal Strength" },
  { key: "sorinex", label: "Sorinex" },
  { key: "elitefts", label: "EliteFTS" },
  { key: "watson_gym_equipment", label: "Watson" },
  { key: "legend_fitness", label: "Legend Fitness" },
  { key: "tuffstuff", label: "TuffStuff" },
  { key: "texas_power_bars", label: "Texas Power Bars" },
  { key: "stryve", label: "Stryve" },
  { key: "cable_athletics", label: "Cable Athletics" },
];

/* ── the form ───────────────────────────────────────────────────────── */

export const FORM_SECTIONS: FormSection[] = [
  // ── SHORT PATH ──────────────────────────────────────────────────────
  {
    id: "A",
    label: "The basics",
    intro: "We pulled this from public info — just confirm it's right.",
    path: "short",
    fields: [
      { id: "a_name", type: "text", label: "Gym name", placeholder: "Your gym's name" },
      { id: "a_address", type: "text", label: "Address", placeholder: "Street address" },
      { id: "a_phone", type: "text", label: "Phone", placeholder: "Front-desk number", format: "tel" },
      { id: "a_website", type: "text", label: "Website", placeholder: "https://", format: "url" },
      { id: "a_instagram", type: "text", label: "Instagram", placeholder: "@yourgym or profile link" },
      {
        id: "a_segment",
        type: "chip-single",
        label: "Which best describes your gym?",
        hint: "This tailors the rest of the form.",
        options: segOpts,
      },
      {
        id: "a_secondary",
        type: "chip-multi",
        label: "Anything else fit too?",
        hint: "Optional — a soft signal, never used to exclude you.",
        options: segOpts,
      },
    ],
  },
  {
    id: "B",
    label: "Hours & access",
    path: "short",
    fields: [
      {
        id: "b_access",
        type: "chip-single",
        label: "How do members get in?",
        hint: "24-hour ACCESS and staffed-24-hours are different — pick the real one.",
        options: [
          { key: "staffed_only", label: "Open during staffed hours only" },
          { key: "access_24", label: "24-hour access (keyfob) — staffed part of the day" },
          { key: "staffed_24", label: "Staffed 24 hours" },
          { key: "appointment_only", label: "By appointment / class schedule only" },
        ],
      },
      {
        id: "b_hours",
        type: "hours-grid",
        label: "Staffed hours",
        hint: "When is your team on site? Leave a day Closed if you're not staffed then. For 24-hour-access gyms this is the front-desk window — not the access hours.",
        showIf: (a) =>
          !(
            a.b_access?.kind === "choice" &&
            (a.b_access.value === "staffed_24" || a.b_access.value === "appointment_only")
          ),
      },
    ],
  },
  {
    id: "C",
    label: "Pricing & passes",
    intro: "The thing people filter on most — and what we can least reliably scrape.",
    path: "short",
    fields: [
      {
        id: "c_dropin",
        type: "chip-single",
        label: "Do you allow drop-ins / day passes?",
        options: dropInOpts,
      },
      {
        id: "c_guest_model",
        type: "chip-single",
        label: "How can a non-member visit?",
        hint: "Pick the closest — add the conditions below.",
        options: guestModelOpts,
      },
      {
        id: "c_daypass",
        type: "currency",
        label: "Day-pass price",
        placeholder: "unlisted",
        showIf: (a) =>
          !(a.c_dropin?.kind === "choice" && a.c_dropin.value === "membership_only") &&
          !(a.c_guest_model?.kind === "choice" && a.c_guest_model.value === "members_only_waitlist"),
      },
      {
        id: "c_members_guest_note",
        type: "text",
        label: "Guest / drop-in conditions",
        placeholder: "e.g. free with a member, $25 without; same guest once a month",
        showIf: (a) =>
          a.c_guest_model?.kind === "choice" &&
          (a.c_guest_model.value === "member_invite_only" || a.c_guest_model.value === "hybrid"),
      },
      { id: "c_weekpass", type: "currency", label: "Week-pass price", placeholder: "unlisted" },
      {
        id: "c_single_class",
        type: "currency",
        label: "Single class (drop-in)",
        placeholder: "unlisted",
        showIf: isClassSegment,
      },
      {
        id: "c_monthly",
        type: "currency",
        label: "Lowest monthly membership",
        placeholder: "starting from",
        hint: "Your cheapest monthly — full plans go in Membership & fees.",
      },
      {
        id: "c_intro_offer",
        type: "text",
        label: "New-member intro offer",
        placeholder: "First week free · $49 intro month · first class free",
      },
      {
        id: "c_notes",
        type: "text-voice",
        label: "Anything else about pricing?",
        placeholder: "e.g. peak vs off-peak, add-ons, what's included.",
      },
    ],
  },
  {
    id: "D",
    label: "Amenities",
    intro: "Tap everything you have. Leave the rest — we never assume a no.",
    path: "short",
    fields: [
      { id: "d_amenities", type: "chip-multi", label: "What's on offer?", options: amenityOpts },
    ],
  },
  {
    id: "G",
    label: "Access & inclusivity",
    path: "short",
    fields: [
      {
        id: "g_womens",
        type: "chip-single",
        label: "Is your facility women's-only, or do you have a dedicated women's area?",
        options: [
          { key: "womens_only", label: "Entire gym is women's-only" },
          { key: "womens_area", label: "We have a dedicated women's-only area" },
          { key: "neither", label: "Neither" },
        ],
      },
      {
        id: "g_accessibility",
        type: "chip-multi",
        label: "Accessibility",
        hint: "Tap what applies — leave blank if unsure.",
        options: [
          { key: "wheelchair_accessible", label: AMENITY_LABELS.wheelchair_accessible },
          { key: "accessible_restrooms", label: AMENITY_LABELS.accessible_restrooms },
        ],
      },
      {
        id: "g_min_age",
        type: "chip-single",
        label: "Minimum age to join / train",
        options: [
          { key: "all_ages", label: "All ages (with guardian)" },
          { key: "13", label: "13+" },
          { key: "16", label: "16+" },
          { key: "18", label: "18+" },
        ],
      },
      { id: "g_youth", type: "tri-state", label: "Do you run youth / kids programs?" },
    ],
  },
  // ── FULL PATH ───────────────────────────────────────────────────────
  {
    id: "E",
    label: "Equipment",
    intro: "Equipment is ground truth on Scout — the more precise, the better you match.",
    path: "full",
    fields: [
      // strength_full
      eq(["dumbbells", "barbells", "kettlebells", "specialty_bars"], {
        id: "e_freeweights",
        label: "Free weights",
        branches: ["strength_full"],
      }),
      eq(["squat_rack", "power_rack", "monolift", "comp_bench", "belt_squat", "reverse_hyper"], {
        id: "e_racks",
        label: "Racks & platforms",
        branches: ["strength_full"],
      }),
      {
        id: "e_squat_count",
        type: "stepper",
        label: "How many squat / power racks?",
        min: 0,
        max: 40,
        unit: "racks",
        branches: ["strength_full"],
      },
      {
        id: "e_db_max",
        type: "stepper",
        label: "Heaviest dumbbell",
        min: 0,
        max: 300,
        step: 5,
        unit: "lbs",
        branches: ["strength_full"],
      },
      eq(["platform", "ghd", "nordic_bench"], {
        id: "e_specialty",
        label: "Specialty",
        branches: ["strength_full"],
      }),
      eq(MACHINE_KEYS, {
        id: "e_machines",
        label: "Strength machines",
        hint: "The machine-level detail powers premium filters (free during beta).",
        branches: ["strength_full"],
      }),
      eq(["sled", "ski_erg", "assault_bike", "rower", "stepmill"], {
        id: "e_conditioning_s",
        label: "Conditioning",
        branches: ["strength_full"],
      }),
      eq(["treadmill", "elliptical", "upright_bike", "recumbent_bike", "stair_climber"], {
        id: "e_cardio_s",
        label: "Cardio",
        hint: "The machines most members spend the most time on.",
        branches: ["strength_full"],
      }),
      eq(["pull_up_bar", "dip_station"], {
        id: "e_bodyweight",
        label: "Bodyweight",
        branches: ["strength_full"],
      }),
      // conditioning (crossfit)
      eq(["sled", "ski_erg", "assault_bike", "rower", "pull_up_bar", "dip_station", "ghd", "platform"], {
        id: "e_cond_c",
        label: "Rigs & conditioning",
        branches: ["conditioning"],
      }),
      eq(["dumbbells", "barbells", "kettlebells"], {
        id: "e_fw_c",
        label: "Free weights",
        branches: ["conditioning"],
      }),
      eq(["squat_rack", "power_rack"], {
        id: "e_racks_c",
        label: "Racks",
        branches: ["conditioning"],
      }),
      {
        id: "e_squat_count_c",
        type: "stepper",
        label: "How many squat / power racks?",
        min: 0,
        max: 40,
        unit: "racks",
        branches: ["conditioning"],
      },
      {
        id: "e_db_max_c",
        type: "stepper",
        label: "Heaviest dumbbell",
        min: 0,
        max: 300,
        step: 5,
        unit: "lbs",
        branches: ["conditioning"],
      },
      // combat (mma / boxing)
      eq(["heavy_bag", "boxing_ring", "mma_cage", "mats"], {
        id: "e_combat",
        label: "Combat equipment",
        branches: ["combat"],
      }),
      eq(["sled", "assault_bike", "rower", "ski_erg", "kettlebells", "dumbbells", "barbells", "pull_up_bar"], {
        id: "e_combat_cond",
        label: "Strength & conditioning",
        branches: ["combat"],
      }),
      // pilates_full (yoga & pilates)
      eq(["reformer", "pilates_tower", "cadillac", "pilates_chair", "pilates_barrel", "aerial_rig", "mats"], {
        id: "e_pilates",
        label: "Studio apparatus",
        hint: "Reformers and apparatus are ground truth for a studio — list what you have.",
        branches: ["pilates_full"],
      }),
      {
        id: "e_reformer_count",
        type: "stepper",
        label: "How many reformers?",
        min: 0,
        max: 60,
        unit: "reformers",
        branches: ["pilates_full"],
      },
      {
        id: "e_pilates_strength",
        type: "tri-state",
        label: "Any strength equipment too?",
        branches: ["pilates_full"],
      },
      eq(["dumbbells", "kettlebells", "cable_machine"], {
        id: "e_pilates_fw",
        label: "Strength equipment",
        branches: ["pilates_full"],
        showIf: (a) => a.e_pilates_strength?.kind === "tri" && a.e_pilates_strength.value === true,
      }),
      // cycling_full (spin)
      eq(["spin_bike", "upright_bike", "rower"], {
        id: "e_cycling",
        label: "Bikes & conditioning",
        branches: ["cycling_full"],
      }),
      {
        id: "e_bike_count",
        type: "stepper",
        label: "How many bikes?",
        min: 0,
        max: 120,
        unit: "bikes",
        branches: ["cycling_full"],
      },
      // barre_min
      eq(["mats", "dumbbells", "kettlebells", "spin_bike"], {
        id: "e_barre",
        label: "Equipment on the floor",
        branches: ["barre_min"],
      }),
      // yoga_toggle (recovery)
      {
        id: "e_any_strength",
        type: "tri-state",
        label: "Any strength equipment on site?",
        branches: ["yoga_toggle"],
      },
      eq(["dumbbells", "barbells", "kettlebells", "squat_rack"], {
        id: "e_yoga_fw",
        label: "What's in the strength area?",
        branches: ["yoga_toggle"],
        showIf: (a) => a.e_any_strength?.kind === "tri" && a.e_any_strength.value === true,
      }),
      // climbing_full
      eq(["climbing_wall"], {
        id: "e_climbing",
        label: "Climbing",
        branches: ["climbing_full"],
      }),
      {
        id: "e_weightroom",
        type: "tri-state",
        label: "Do you also have a weight room?",
        branches: ["climbing_full"],
      },
      eq(["dumbbells", "barbells", "squat_rack", "pull_up_bar"], {
        id: "e_climb_fw",
        label: "What's in the weight room?",
        branches: ["climbing_full"],
        showIf: (a) => a.e_weightroom?.kind === "tri" && a.e_weightroom.value === true,
      }),
      // boutique_min
      eq(["dumbbells", "kettlebells", "pull_up_bar", "rower", "assault_bike"], {
        id: "e_boutique",
        label: "Equipment on the floor",
        branches: ["boutique_min"],
      }),
      // ── expanded equipment groups (render in their branches) ──────────
      eq(["curved_treadmill", "versaclimber", "jacobs_ladder", "arc_trainer", "incline_trainer", "water_rower", "recumbent_stepper", "upper_body_ergometer"], {
        id: "e_cardio_x",
        label: "Specialty cardio",
        branches: ["strength_full", "conditioning"],
      }),
      eq(["chest_press_machine", "shoulder_press_machine", "lat_pulldown_machine", "seated_row_machine", "pec_deck", "rear_delt_machine", "lateral_raise_machine", "preacher_curl_machine", "tricep_extension_machine", "tricep_pushdown_machine", "assisted_pull_up_dip_machine", "ab_crunch_machine", "back_extension_machine", "torso_rotation_machine", "glute_machine", "lat_pullover_machine", "cable_crossover"], {
        id: "e_selectorized",
        label: "Selectorized machines",
        hint: "Pin / weight-stack machines.",
        branches: ["strength_full"],
      }),
      eq(["iso_lateral_chest_press", "iso_lateral_incline_press", "iso_lateral_shoulder_press", "iso_lateral_row", "iso_lateral_pulldown", "t_bar_row_machine", "pendulum_squat", "v_squat", "linear_leg_press", "seated_dip_machine", "landmine_station"], {
        id: "e_plate_loaded",
        label: "Plate-loaded machines",
        hint: "Hammer Strength / iso-lateral style.",
        branches: ["strength_full"],
      }),
      eq(["adjustable_bench", "flat_bench", "incline_bench", "decline_bench", "preacher_bench", "adjustable_dumbbells", "bumper_plates", "weight_plates", "change_plates", "trap_bar", "ez_curl_bar", "safety_squat_bar", "swiss_bar", "fat_grip_bar", "half_rack", "wall_mounted_rack", "deadlift_jack", "resistance_bands", "jerk_blocks"], {
        id: "e_benches",
        label: "Benches, bars & plates",
        branches: ["strength_full", "conditioning"],
      }),
      eq(["battle_ropes", "plyo_boxes", "medicine_balls", "slam_balls", "wall_balls", "suspension_trainer", "gymnastic_rings", "parallettes", "climbing_rope", "jump_ropes", "agility_ladder", "ab_wheel", "weighted_vest", "sandbags", "balance_trainer", "stability_ball", "vibration_plate"], {
        id: "e_functional",
        label: "Functional & accessories",
        branches: ["strength_full", "conditioning"],
      }),
      eq(["tires", "atlas_stones", "yoke", "farmers_handles", "log_bar"], {
        id: "e_strongman",
        label: "Strongman",
        branches: ["strength_full", "conditioning"],
      }),
      eq(["ballet_barre", "spring_wall", "magic_circle", "spine_corrector", "jump_board", "yoga_blocks", "yoga_straps", "yoga_bolsters", "yoga_wheel", "yoga_swing", "pilates_mat", "toning_balls", "balance_pad", "balance_board", "ankle_weights"], {
        id: "e_studio",
        label: "Studio props & apparatus",
        branches: ["pilates_full", "barre_min"],
      }),
      eq(["speed_bag", "double_end_bag", "muay_thai_bag", "uppercut_bag", "free_standing_bag", "body_opponent_bag", "reflex_bag", "aqua_bag", "grappling_dummy", "wing_chun_dummy", "focus_mitts_area"], {
        id: "e_combat_x",
        label: "Bags & combat (more)",
        branches: ["combat"],
      }),
      eq(["foam_roller", "normatec_boots", "massage_gun", "stretching_station", "inversion_table"], {
        id: "e_recovery",
        label: "Recovery equipment",
        hint: "On-site recovery tools.",
      }),
      // ── brands (all branches): multiple-choice + free-text catch-all ──
      {
        id: "e_brands",
        type: "chip-multi",
        label: "Brands on the floor",
        hint: "Tap the major brands you have — add any others below.",
        options: BRAND_OPTIONS,
      },
      {
        id: "e_brands_other",
        type: "text",
        label: "Other brands not listed",
        placeholder: "e.g. Arsenal Strength, Sorinex, Watson…",
      },
    ],
  },
  {
    id: "M",
    label: "Membership & fees",
    intro: "The real cost — plans, fees, and commitment. Every field is optional.",
    path: "full",
    fields: [
      {
        id: "m_plans",
        type: "membership-plans",
        label: "Membership plans",
        hint: "Add each plan and its price by commitment length (annual is usually cheapest).",
      },
      {
        id: "m_enrollment_fee",
        type: "currency",
        label: "Enrollment / initiation fee",
        placeholder: "unlisted (often $0 on promo)",
      },
      { id: "m_annual_fee", type: "currency", label: "Annual fee", placeholder: "e.g. $59" },
      {
        id: "m_annual_fee_label",
        type: "text",
        label: "What do you call the annual fee?",
        placeholder: "Club enhancement fee",
        showIf: (a) => a.m_annual_fee?.kind === "num" && a.m_annual_fee.value !== null,
      },
      {
        id: "m_commitment",
        type: "chip-multi",
        label: "Commitment terms you offer",
        options: commitmentOpts,
      },
      {
        id: "m_early_term",
        type: "chip-single",
        label: "Break an annual commitment — what's required?",
        options: earlyTermOpts,
        showIf: offersContract,
      },
      {
        id: "m_early_term_note",
        type: "text",
        label: "Early-termination detail",
        placeholder: "e.g. 50% of remaining months",
        showIf: (a) =>
          a.m_early_term?.kind === "choice" &&
          (a.m_early_term.value === "flat_fee" ||
            a.m_early_term.value === "buyout_remaining" ||
            a.m_early_term.value === "months_dues"),
      },
      {
        id: "m_cancel_days",
        type: "stepper",
        label: "Cancellation notice required",
        min: 0,
        max: 90,
        unit: "days",
      },
      {
        id: "m_freeze",
        type: "text",
        label: "Can members freeze / hold? Any fee?",
        placeholder: "e.g. up to 3 months, $10/mo",
      },
      { id: "m_discounts", type: "chip-multi", label: "Discounts offered", options: discountOpts },
      { id: "m_app_required", type: "tri-state", label: "Is your app required to get in?" },
      { id: "m_waitlist", type: "tri-state", label: "Is there a membership waitlist?" },
    ],
  },
  {
    id: "F",
    label: "Parking",
    path: "full",
    fields: [
      { id: "f_kind", type: "chip-single", label: "Parking situation?", options: parkingKindOpts },
      { id: "f_access", type: "chip-single", label: "Cost?", options: parkingAccessOpts },
      {
        id: "f_fee",
        type: "text",
        label: "Fee / detail",
        placeholder: "$2/hr after 1 free hour",
        showIf: (a) =>
          a.f_access?.kind === "choice" &&
          (a.f_access.value === "paid" || a.f_access.value === "validated" || a.f_access.value === "permit"),
      },
    ],
  },
  {
    id: "H",
    label: "Vibe & positioning",
    path: "full",
    fields: [
      {
        id: "h_vibes",
        type: "chip-multi",
        label: "Pick up to 3 that describe the feel",
        hint: "Soft signals — they boost the right searches, never exclude you.",
        options: vibeOpts,
        maxSelect: 3,
      },
      {
        id: "h_diff",
        type: "text-voice",
        label: "Who's it for / what makes you different?",
        placeholder: "The one line you'd want a new member to read.",
      },
    ],
  },
  {
    id: "I",
    label: "Photos",
    path: "full",
    fields: [{ id: "i_photos", type: "photo-stub", label: "Add photos of your space" }],
  },
  {
    id: "J",
    label: "Anything else",
    path: "full",
    fields: [
      {
        id: "j_voice",
        type: "text-voice",
        label: "Anything else we should know about your gym?",
        placeholder: "Talk for 30 seconds about what makes your gym special — we'll sort out the details.",
        large: true,
      },
    ],
  },
  {
    id: "K",
    label: "Your contact",
    intro: "So we can verify the listing and reach you — never shown publicly.",
    path: "full",
    fields: [
      { id: "ct_name", type: "text", label: "Your name" },
      {
        id: "ct_role",
        type: "chip-single",
        label: "Your role",
        options: [
          { key: "owner", label: "Owner" },
          { key: "manager", label: "Manager" },
          { key: "staff", label: "Staff" },
          { key: "other", label: "Other" },
        ],
      },
      { id: "ct_email", type: "text", label: "Email", placeholder: "you@yourgym.com", format: "email" },
      { id: "ct_phone", type: "text", label: "Phone (optional)", placeholder: "Direct line", format: "tel" },
    ],
  },
];

/** Section display order (short first, then full). */
export const SECTION_ORDER = FORM_SECTIONS.map((s) => s.id);
export const SHORT_SECTIONS = FORM_SECTIONS.filter((s) => s.path === "short").map((s) => s.id);
export const FULL_SECTIONS = FORM_SECTIONS.filter((s) => s.path === "full").map((s) => s.id);

/** Active equipment branches = primary segment UNION any secondary segments
 *  (so a CrossFit-that's-also-a-barbell-club sees both question sets — C5). */
export function activeBranches(segment: GymSegment | null, answers: AnswerMap): Set<EquipmentBranch> {
  const out = new Set<EquipmentBranch>();
  if (segment) out.add(EQUIPMENT_BRANCH_MAP[segment]);
  const secondary = answers.a_secondary?.kind === "chips" ? answers.a_secondary.value : [];
  for (const s of secondary) {
    if (s in EQUIPMENT_BRANCH_MAP) out.add(EQUIPMENT_BRANCH_MAP[s as GymSegment]);
  }
  if (out.size === 0) out.add("strength_full");
  return out;
}

/** Fields visible for a section given the gym's segment(s) + current answers. */
export function visibleFields(section: FormSection, segment: GymSegment | null, answers: AnswerMap): FieldDef[] {
  const branches = activeBranches(segment, answers);
  return section.fields.filter((f) => {
    if (f.branches && !f.branches.some((b) => branches.has(b))) return false;
    if (f.showIf && !f.showIf(answers)) return false;
    return true;
  });
}
