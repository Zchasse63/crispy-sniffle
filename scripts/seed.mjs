/**
 * Scout seed script — loads the researched Tampa dataset (+ a basic-tier Miami)
 * into Supabase with honest per-field provenance.
 *
 * Usage:  node scripts/seed.mjs        (reads .env.local)
 * Re-runnable: gyms upsert by slug; amenities/equipment are replaced per gym.
 *
 * Provenance rules:
 *   - facts from the research dataset      → source 'seed',      confidence from research
 *   - conservative segment/chain inferences → source 'estimated', confidence ≤ 0.55
 *   - nothing is ever presented as verified that isn't.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { canOverwrite } from "./lib/provenance.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// ── env (.env.local, no dotenv dependency) ─────────────────────────
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(URL_, SERVICE_KEY, { auth: { persistSession: false } });

// ── normalization maps ──────────────────────────────────────────────
const SEGMENT_MAP = {
  strength: "strength",
  crossfit: "crossfit",
  "big-box": "big_box",
  boutique: "boutique",
  climbing: "climbing",
  "yoga-pilates": "yoga_pilates",
  mma: "mma",
  recovery: "recovery",
};
const NEIGHBORHOOD_MAP = {
  "Carrollwood": "Carrollwood",
  "North Tampa/USF area": "North Tampa",
  "Seminole Heights": "Seminole Heights",
  "South Tampa/Bayshore": "South Tampa",
  "Westshore/International Plaza area": "Westshore",
  "Downtown/Channel District": "Downtown",
  "Ybor City": "Ybor City",
  "Hyde Park/SoHo": "Hyde Park",
};
const AMENITY_MAP = { group_classes: "classes" }; // researcher key → catalog key

const slugify = (name) =>
  name
    .toLowerCase()
    .replace(/\[|\]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ── structured hours (hand-derived from researched hours_note) ──────
const H = (o, c) => [o, c];
const HOURS = {
  "powerhouse-gym-athletic-club": { mon: H("05:00", "24:00"), tue: H("05:00", "24:00"), wed: H("05:00", "24:00"), thu: H("05:00", "24:00"), fri: H("05:00", "24:00"), sat: H("07:00", "21:00"), sun: H("07:00", "21:00") },
  "cigar-city-crossfit": { mon: H("06:30", "20:30"), tue: H("06:30", "20:30"), wed: H("06:30", "20:30"), thu: H("06:30", "20:30"), fri: H("06:30", "20:30"), sat: H("10:00", "12:00") },
  "crunch-fitness-carrollwood": { mon: H("05:00", "23:00"), tue: H("05:00", "23:00"), wed: H("05:00", "23:00"), thu: H("05:00", "23:00"), fri: H("05:00", "22:00"), sat: H("07:00", "19:00"), sun: H("07:00", "19:00") },
  "crunch-fitness-south-tampa": { mon: H("05:00", "23:00"), tue: H("05:00", "23:00"), wed: H("05:00", "23:00"), thu: H("05:00", "23:00"), fri: H("05:00", "22:00"), sat: H("07:00", "19:00"), sun: H("07:00", "19:00") },
  "la-fitness-tampa-s-dale-mabry-signature": { mon: H("05:00", "22:00"), tue: H("05:00", "22:00"), wed: H("05:00", "22:00"), thu: H("05:00", "22:00"), fri: H("05:00", "21:00"), sat: H("08:00", "18:00"), sun: H("08:00", "18:00") },
  "bayshore-fit": { mon: H("05:30", "20:30"), tue: H("05:30", "20:30"), wed: H("05:30", "20:30"), thu: H("05:30", "20:30"), fri: H("05:30", "20:30"), sat: H("07:00", "18:00"), sun: H("08:00", "17:00") },
  "central-rock-gym-tampa": { mon: H("06:00", "22:00"), tue: H("10:00", "22:00"), wed: H("06:00", "22:00"), thu: H("10:00", "22:00"), fri: H("10:00", "22:00"), sat: H("10:00", "20:00"), sun: H("12:00", "20:00") },
  "central-rock-gym-citrus-park": { mon: H("10:00", "22:00"), tue: H("06:00", "22:00"), wed: H("10:00", "22:00"), thu: H("06:00", "22:00"), fri: H("10:00", "22:00"), sat: H("10:00", "20:00"), sun: H("10:00", "20:00") },
  "kodawari-studios": { mon: H("06:00", "20:30"), tue: H("06:00", "20:30"), wed: H("06:00", "20:30"), thu: H("06:00", "20:30"), fri: H("06:00", "20:30"), sat: H("07:30", "15:00"), sun: H("08:00", "20:30") },
  "camp-tampa": { mon: H("05:15", "20:30"), tue: H("05:15", "20:30"), wed: H("05:15", "20:30"), thu: H("05:15", "20:30"), fri: H("05:15", "20:30"), sat: H("07:00", "17:00"), sun: H("07:00", "17:00") },
  "tampa-muay-thai": { mon: H("07:00", "21:00"), tue: H("07:00", "21:00"), wed: H("07:00", "21:00"), thu: H("07:00", "21:00"), fri: H("07:00", "20:00"), sat: H("09:00", "14:00") },
  "westshore-crossfit": { mon: H("05:30", "19:30"), tue: H("05:30", "19:30"), wed: H("05:30", "19:30"), thu: H("05:30", "19:30"), fri: H("05:30", "19:30"), sat: H("09:00", "13:00") },
  "dale-mabry-crossfit": { mon: H("05:30", "19:00"), tue: H("05:30", "19:00"), wed: H("05:30", "19:00"), thu: H("05:30", "19:00"), fri: H("05:30", "19:00"), sat: H("08:00", "11:00") },
  "bella-prana-yoga-and-meditation": { mon: H("06:00", "21:00"), tue: H("06:00", "21:00"), wed: H("06:00", "21:00"), thu: H("06:00", "21:00"), fri: H("06:00", "21:00"), sat: H("08:00", "18:00"), sun: H("08:00", "18:00") },
};

// ── conservative inference tables (source: 'estimated') ────────────
// Segment-level facts that are near-universally true for the type, kept
// deliberately modest and clearly labeled in the UI via provenance.
const CROSSFIT_EST_EQUIPMENT = [
  { equipment_key: "barbells", detail: "Standard for CrossFit affiliates" },
  { equipment_key: "kettlebells", detail: "Standard for CrossFit affiliates" },
  { equipment_key: "pull_up_bar", detail: "Rig — standard for CrossFit affiliates" },
  { equipment_key: "rower", detail: "Standard for CrossFit affiliates" },
];
const EST_EQUIPMENT = {
  // strength gyms — modest quantity/weight estimates, clearly flagged
  "powerhouse-gym-athletic-club": [
    { equipment_key: "squat_rack", quantity: 8, detail: "Estimate for a 50,000 sq ft strength gym" },
    { equipment_key: "dumbbells", max_weight_lbs: 150, detail: "Typical for serious bodybuilding gyms" },
    { equipment_key: "platform", quantity: 2 },
    { equipment_key: "cable_machine" },
    { equipment_key: "hack_squat" },
  ],
  "powerhouse-gym-north-tampa": [
    { equipment_key: "squat_rack", quantity: 4 },
    { equipment_key: "dumbbells", max_weight_lbs: 130, detail: "Typical for bodybuilding-focused gyms" },
    { equipment_key: "cable_machine" },
  ],
  "813-barbell": [
    { equipment_key: "squat_rack", quantity: 6, detail: "Estimate for a dedicated powerlifting gym" },
    { equipment_key: "platform", quantity: 4 },
    { equipment_key: "dumbbells", max_weight_lbs: 125 },
    { equipment_key: "monolift", quantity: 1, detail: "Referenced in gym description" },
    { equipment_key: "belt_squat" },
  ],
  // big-box chains — brand patterns common across the chain
  "crunch-fitness-carrollwood": [
    { equipment_key: "dumbbells", max_weight_lbs: 100, detail: "Typical Crunch dumbbell run" },
    { equipment_key: "cable_machine", brand: "Hammer Strength", detail: "Common across Crunch locations" },
  ],
  "crunch-fitness-south-tampa": [
    { equipment_key: "dumbbells", max_weight_lbs: 100, detail: "Typical Crunch dumbbell run" },
    { equipment_key: "cable_machine", brand: "Hammer Strength", detail: "Common across Crunch locations" },
  ],
  "eos-fitness-tampa-midtown": [
    { equipment_key: "dumbbells", max_weight_lbs: 120, detail: "EoS is known for heavier dumbbell runs" },
    { equipment_key: "leg_press", brand: "Hammer Strength", detail: "Common across EoS locations" },
    { equipment_key: "sled", detail: "Turf area implies sled work" },
  ],
  "la-fitness-tampa-s-dale-mabry-signature": [
    { equipment_key: "dumbbells", max_weight_lbs: 100, detail: "Typical LA Fitness dumbbell run" },
    { equipment_key: "cable_machine", brand: "Life Fitness", detail: "Common across LA Fitness locations" },
  ],
  "anytime-fitness-carrollwood": [
    { equipment_key: "dumbbells", max_weight_lbs: 80, detail: "Typical compact-club dumbbell run" },
  ],
  "life-time-harbour-island": [
    { equipment_key: "dumbbells", max_weight_lbs: 110, detail: "Typical Life Time dumbbell run" },
    { equipment_key: "cable_machine", brand: "Life Fitness", detail: "Common across Life Time clubs" },
  ],
  "f45-training-sparkman-tampa": [{ equipment_key: "rower", detail: "Standard F45 station" }],
};
const EST_BRAND_FOR_CROSSFIT = { brand: "Rogue", detail: "Rogue rigs/bars are standard at most CrossFit affiliates" };

// ── basic-tier Miami (trips demo) — real, well-known gyms, low detail ──
const MIAMI = {
  city: { slug: "miami", name: "Miami", state: "FL", lat: 25.7617, lng: -80.1918, tier: "basic" },
  gyms: [
    {
      name: "Anatomy Midtown", segment: "boutique", neighborhood: "Midtown",
      address: "3415 NE 2nd Ave, Miami, FL 33137", lat: 25.808, lng: -80.193,
      website: "https://www.anatomyfitness.com/", confidence: 0.6,
      description: "High-end fitness club in Midtown Miami known for its training floor, classes and recovery amenities.",
      known_amenities: ["classes", "personal_training", "sauna", "recovery_room", "towel_service"],
      known_equipment: [{ key: "squat_rack" }, { key: "dumbbells" }],
    },
    {
      name: "Legacy Fit Wynwood", segment: "boutique", neighborhood: "Wynwood",
      address: "413 NW 26th St, Miami, FL 33127", lat: 25.801, lng: -80.199,
      website: "https://legacyfit.com/", confidence: 0.6,
      description: "High-intensity group training brand born in Wynwood — coached circuit workouts with a big local following.",
      known_amenities: ["classes", "personal_training"],
      known_equipment: [{ key: "dumbbells" }, { key: "sled" }],
    },
    {
      name: "Equinox Brickell Heights", segment: "big-box", neighborhood: "Brickell",
      address: "25 SW 9th St, Miami, FL 33130", lat: 25.764, lng: -80.194,
      website: "https://www.equinox.com/clubs/florida/miami/brickellheights", confidence: 0.6,
      description: "Luxury full-service club in Brickell Heights with pool, spa-grade amenities and a complete training floor.",
      known_amenities: ["classes", "personal_training", "pool", "sauna", "steam_room", "towel_service"],
      known_equipment: [{ key: "squat_rack" }, { key: "dumbbells" }],
    },
  ],
};

// ── helpers ─────────────────────────────────────────────────────────
async function upsertCity(city, tier) {
  const { data, error } = await db
    .from("cities")
    .upsert({ ...city, tier }, { onConflict: "slug" })
    .select("id, slug")
    .single();
  if (error) throw new Error(`city ${city.slug}: ${error.message}`);
  return data.id;
}

function dayPassAmenity(priceNote) {
  if (!priceNote) return null;
  if (/day pass|guest pass|drop|trial|first (class|workout) free|7-day pass|intro/i.test(priceNote)) {
    return { amenity_key: "day_pass", present: true, source: "seed", confidence: 0.6, detail: priceNote };
  }
  return null;
}

async function seedGym(cityId, g, { crossfitExtras = false } = {}) {
  const slug = slugify(g.name);
  const conf = Math.min(g.confidence ?? 0.6, 0.85);
  const hours = g.open_24h ? { open_24h: true } : (HOURS[slug] ?? null);

  const row = {
    slug,
    city_id: cityId,
    name: g.name.replace(/^\[|\]/g, "").replace("[solidcore]", "Solidcore"),
    neighborhood: NEIGHBORHOOD_MAP[g.neighborhood] ?? g.neighborhood ?? null,
    address: g.address ?? null,
    lat: g.lat ?? null,
    lng: g.lng ?? null,
    description: g.description ?? null,
    segment: SEGMENT_MAP[g.segment] ?? null,
    day_pass_price: g.day_pass_price ?? null,
    hours,
    website: g.website ?? null,
    verified: false,
  };
  const { data: gym, error } = await db
    .from("gyms")
    .upsert(row, { onConflict: "slug" })
    .select("id")
    .single();
  if (error) throw new Error(`gym ${slug}: ${error.message}`);

  // Read existing per-key sources BEFORE writing anything, so a rerun never
  // deletes/overwrites a fact a higher-ranked source (owner/scout_verified/
  // user) has since attached to this gym — reconciled per-key below, never a
  // blanket delete-all of the gym's rows.
  const { data: existingAmen } = await db
    .from("gym_amenities")
    .select("amenity_key, source")
    .eq("gym_id", gym.id);
  const existingAmenBySource = new Map((existingAmen ?? []).map((a) => [a.amenity_key, a.source]));
  const { data: existingEq } = await db
    .from("gym_equipment")
    .select("equipment_key, source")
    .eq("gym_id", gym.id);
  const existingEqBySource = new Map((existingEq ?? []).map((e) => [e.equipment_key, e.source]));

  const amenities = new Map();
  for (const a of g.known_amenities ?? []) {
    const key = AMENITY_MAP[a] ?? a;
    amenities.set(key, { gym_id: gym.id, amenity_key: key, present: true, source: "seed", confidence: conf });
  }
  if (g.open_24h) {
    amenities.set("open_24h", { gym_id: gym.id, amenity_key: "open_24h", present: true, source: "seed", confidence: 0.8, detail: g.hours_note ?? null });
  }
  const dp = dayPassAmenity(g.price_note);
  if (dp) amenities.set("day_pass", { gym_id: gym.id, ...dp });
  // never overwrite a higher-ranked existing fact — drop those keys entirely
  // rather than replace them (seed is always source: "seed" here).
  for (const key of [...amenities.keys()]) {
    if (!canOverwrite("seed", existingAmenBySource.get(key))) amenities.delete(key);
  }
  if (amenities.size > 0) {
    const { error: de } = await db
      .from("gym_amenities")
      .delete()
      .eq("gym_id", gym.id)
      .in("amenity_key", [...amenities.keys()]);
    if (de) throw new Error(`amenities delete ${slug}: ${de.message}`);
    const { error: ae } = await db.from("gym_amenities").insert([...amenities.values()]);
    if (ae) throw new Error(`amenities ${slug}: ${ae.message}`);
  }

  const equipment = new Map();
  for (const e of g.known_equipment ?? []) {
    equipment.set(e.key, {
      gym_id: gym.id,
      equipment_key: e.key,
      brand: e.brand ?? null,
      quantity: e.quantity ?? null,
      max_weight_lbs: e.max_weight_lbs ?? null,
      source: "seed",
      confidence: conf,
      detail: e.detail ?? null,
    });
  }
  const estimates = [...(EST_EQUIPMENT[slug] ?? [])];
  if (crossfitExtras) {
    estimates.push(...CROSSFIT_EST_EQUIPMENT);
  }
  for (const est of estimates) {
    const existing = equipment.get(est.equipment_key);
    if (existing) {
      // enrich missing attributes only; keep 'seed' provenance for the fact itself
      existing.quantity ??= est.quantity ?? null;
      existing.max_weight_lbs ??= est.max_weight_lbs ?? null;
      if (!existing.brand && est.brand) {
        existing.brand = est.brand;
        existing.detail = est.detail ?? existing.detail;
        existing.source = "estimated";
        existing.confidence = Math.min(existing.confidence, 0.55);
      } else if (est.quantity || est.max_weight_lbs) {
        existing.source = "estimated";
        existing.confidence = Math.min(existing.confidence, 0.55);
        existing.detail ??= est.detail ?? null;
      }
    } else {
      equipment.set(est.equipment_key, {
        gym_id: gym.id,
        equipment_key: est.equipment_key,
        brand: est.brand ?? null,
        quantity: est.quantity ?? null,
        max_weight_lbs: est.max_weight_lbs ?? null,
        source: "estimated",
        confidence: 0.5,
        detail: est.detail ?? null,
      });
    }
  }
  if (crossfitExtras) {
    // Rogue rig estimate applies to the rack/platform rows
    for (const key of ["squat_rack", "platform", "pull_up_bar"]) {
      const rec = equipment.get(key);
      if (rec && !rec.brand) {
        rec.brand = EST_BRAND_FOR_CROSSFIT.brand;
        rec.detail = rec.detail ?? EST_BRAND_FOR_CROSSFIT.detail;
        if (rec.source === "seed") rec.source = "estimated";
        rec.confidence = Math.min(rec.confidence, 0.55);
      }
    }
  }
  // Physical implication: any facility with squat/power racks has barbells.
  // Keeps capability matching honest without per-gym hand entry.
  if (
    (equipment.has("squat_rack") || equipment.has("power_rack")) &&
    !equipment.has("barbells")
  ) {
    equipment.set("barbells", {
      gym_id: gym.id,
      equipment_key: "barbells",
      brand: null,
      quantity: null,
      max_weight_lbs: null,
      source: "estimated",
      confidence: 0.6,
      detail: "Racks imply barbells",
    });
  }
  // never overwrite a higher-ranked existing fact — use each entry's OWN
  // final source (a key can flip 'seed' → 'estimated' during the merge
  // above), and drop the key entirely rather than replace it when outranked.
  for (const [key, rec] of [...equipment.entries()]) {
    if (!canOverwrite(rec.source, existingEqBySource.get(key))) equipment.delete(key);
  }
  if (equipment.size > 0) {
    const { error: de } = await db
      .from("gym_equipment")
      .delete()
      .eq("gym_id", gym.id)
      .in("equipment_key", [...equipment.keys()]);
    if (de) throw new Error(`equipment delete ${slug}: ${de.message}`);
    const { error: ee } = await db.from("gym_equipment").insert([...equipment.values()]);
    if (ee) throw new Error(`equipment ${slug}: ${ee.message}`);
  }
  return slug;
}

// ── run ─────────────────────────────────────────────────────────────
const research = JSON.parse(readFileSync(resolve(root, "data/tampa-research.json"), "utf8"));

console.log("Seeding Tampa (rich tier)…");
const tampaId = await upsertCity(research.city, "rich");
let n = 0;
for (const g of research.gyms) {
  const slug = await seedGym(tampaId, g, { crossfitExtras: g.segment === "crossfit" });
  n++;
  console.log(`  ✓ ${slug}`);
}
console.log(`Tampa: ${n} gyms seeded.`);

console.log("Seeding Miami (basic tier)…");
const miamiId = await upsertCity(MIAMI.city, "basic");
for (const g of MIAMI.gyms) {
  const slug = await seedGym(miamiId, g);
  console.log(`  ✓ ${slug}`);
}
console.log(`Miami: ${MIAMI.gyms.length} gyms seeded.`);
console.log("Done.");
