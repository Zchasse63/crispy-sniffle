/**
 * Scout enrichment loader — merges deep-scraped gym facts into Supabase
 * with provenance override semantics.
 *
 * Input:  data/tampa-enriched.json  (array of per-gym objects keyed by slug,
 *         produced by the website-scrape research agents)
 * Ladder: scraped (0.85) overrides seed / estimated rows for the same key;
 *         facts the scrape doesn't mention are left untouched.
 * Field merge: when a scraped equipment row omits quantity/max/brand that an
 *         existing row had, the value is inherited and flagged in `detail`.
 *
 * Usage:  node scripts/enrich.mjs [--dry-run] [--file data/<city>-enriched.json]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { canOverwrite, isValidClock } from "./lib/provenance.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");

for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const AMENITY_KEYS = new Set([
  "sauna", "cold_plunge", "steam_room", "pool", "recovery_room", "open_24h",
  "classes", "personal_training", "turf_area", "cardio_zone", "basketball_court",
  "day_pass", "parking", "lockers", "showers", "towel_service", "wifi",
  "juice_bar", "childcare",
]);
const EQUIPMENT_KEYS = new Set([
  "squat_rack", "power_rack", "platform", "dumbbells", "barbells", "kettlebells",
  "ghd", "sled", "ski_erg", "assault_bike", "rower", "reverse_hyper", "belt_squat",
  "comp_bench", "cable_machine", "leg_press", "smith_machine", "hack_squat",
  "pull_up_bar", "dip_station", "monolift", "climbing_wall",
]);
const DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Stale-risk gyms: facts sourced from ARCHIVED sites (their own site is
 *  dead) or contradicted by corporate locators. Published ≠ verified —
 *  their scraped confidence is capped so the UI shows the uncertainty. */
const STALE_RISK = new Set([
  "westshore-crossfit",          // site unpublished; facts from web.archive.org
  "dale-mabry-crossfit",         // site dead; facts from directory listings
  "9round-fitness-tampa-henderson-blvd", // corporate locator lists no Tampa club
]);
const scrapedConfidence = (slug) => (STALE_RISK.has(slug) ? 0.6 : 0.85);

function cleanHours(h) {
  if (!h || typeof h !== "object") return null;
  if (h.open_24h === true) return { open_24h: true };
  const out = {};
  for (const d of DAYS) {
    const r = h[d];
    if (Array.isArray(r) && r.length === 2 && isValidClock(r[0]) && isValidClock(r[1])) {
      out[d] = [r[0], r[1]];
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}
const price = (v) => (typeof v === "number" && v >= 3 && v <= 300 ? v : null);
const httpsUrl = (v) =>
  typeof v === "string" && v.startsWith("https://") && v.length < 500 ? v : null;

const fileIdx = process.argv.indexOf("--file");
const INPUT = fileIdx > -1 && process.argv[fileIdx + 1]
  ? process.argv[fileIdx + 1]
  : "data/tampa-enriched.json";
const enriched = JSON.parse(readFileSync(resolve(root, INPUT), "utf8"));
console.log(`input: ${INPUT}`);
console.log(`${enriched.length} enriched gyms · ${DRY ? "DRY RUN" : "writing"}\n`);

const stats = { gyms: 0, prices: 0, hours: 0, photos: 0, phones: 0, descriptions: 0, amenities: 0, equipment: 0, ownerSkipped: 0, skipped: [] };

for (const g of enriched) {
  if (!g?.slug) continue;
  const { data: row, error } = await db
    .from("gyms")
    .select("id, hours, description, website, photo_url, owner_listed")
    .eq("slug", g.slug)
    .maybeSingle();
  if (error || !row) {
    stats.skipped.push(g.slug);
    continue;
  }
  stats.gyms++;

  // ── gyms row updates (only fields the scrape actually produced) ──
  const patch = {};
  const now = new Date().toISOString();
  const dp = price(g.day_pass_price);
  const wp = price(g.week_pass_price);
  // owner_listed guard — per-field source lands in WP-D. The gyms table has
  // no per-field provenance yet, so this is an interim, coarse gate: once an
  // owner has published this gym, a scrape may never overwrite any of the
  // owner-settable scalars below (name/phone/website/day_pass_price/
  // week_pass_price/hours — mirrors SCALAR_MAP in src/lib/owner/parse.ts).
  // Pure metadata (photo_url, description) isn't owner-settable today, so it
  // stays ungated.
  const ownerLocked = row.owner_listed === true;
  if (ownerLocked) stats.ownerSkipped++;
  // Scraped-tier facts still stamp the verified-at columns — a scrape
  // confirms existence-at-source (0.85 confidence), which is real freshness
  // signal even though it renders as "Updated", never "Owner-verified" (that
  // wording is gated on gyms.verified/owner_listed, not on this stamp alone).
  if (dp !== null && !ownerLocked) { patch.day_pass_price = dp; patch.day_pass_verified_at = now; stats.prices++; }
  if (wp !== null && !ownerLocked) patch.week_pass_price = wp;
  if (typeof g.phone === "string" && g.phone.length >= 7 && g.phone.length <= 25 && !ownerLocked) {
    patch.phone = g.phone; stats.phones++;
  }
  const photo = httpsUrl(g.photo_url);
  // Only patch on an actual url change, and clear the rehosted copy so the new
  // hero shows (gymPhotoUrl prefers photo_storage_path until rehost re-runs).
  if (photo && photo !== row.photo_url) { patch.photo_url = photo; patch.photo_storage_path = null; stats.photos++; }
  if (typeof g.description === "string" && g.description.length > 60) {
    patch.description = g.description.trim(); stats.descriptions++;
  }
  const hours = cleanHours(g.hours);
  if (hours && !ownerLocked) { patch.hours = hours; patch.hours_verified_at = now; stats.hours++; }
  const foundSite = httpsUrl(g.found_website ?? g.website);
  if (foundSite && foundSite !== row.website && !ownerLocked) patch.website = foundSite;
  // explicit rebrand support (e.g., Cigar City CrossFit → NOEQL Training Co.)
  if (typeof g.name === "string" && g.name.length > 2 && g.name.length < 80 && !ownerLocked) {
    patch.name = g.name;
  }

  if (Object.keys(patch).length > 0 && !DRY) {
    const { error: ue } = await db.from("gyms").update(patch).eq("id", row.id);
    if (ue) throw new Error(`${g.slug} gyms update: ${ue.message}`);
  }

  // ── amenities: scraped overrides whatever held the key before, but never
  // a higher-ranked existing fact (owner/scout_verified/user) ──
  const { data: existingAmenities } = await db
    .from("gym_amenities")
    .select("amenity_key, source")
    .eq("gym_id", row.id);
  const existingAmenBySource = new Map((existingAmenities ?? []).map((a) => [a.amenity_key, a.source]));
  const amenityRows = [];
  const seen = new Set();
  for (const a of Array.isArray(g.amenities) ? g.amenities : []) {
    const key = a?.key;
    if (!AMENITY_KEYS.has(key) || seen.has(key)) continue;
    seen.add(key);
    if (!canOverwrite("scraped", existingAmenBySource.get(key))) continue;
    amenityRows.push({
      gym_id: row.id,
      amenity_key: key,
      present: true,
      source: "scraped",
      confidence: scrapedConfidence(g.slug),
      detail: typeof a.detail === "string" ? a.detail.slice(0, 200) : null,
    });
  }
  if (dp !== null && !seen.has("day_pass") && canOverwrite("scraped", existingAmenBySource.get("day_pass"))) {
    amenityRows.push({
      gym_id: row.id, amenity_key: "day_pass", present: true,
      source: "scraped", confidence: scrapedConfidence(g.slug),
      detail: typeof g.price_note === "string" ? g.price_note.slice(0, 200) : null,
    });
  }
  if (hours?.open_24h && !seen.has("open_24h") && canOverwrite("scraped", existingAmenBySource.get("open_24h"))) {
    amenityRows.push({
      gym_id: row.id, amenity_key: "open_24h", present: true,
      source: "scraped", confidence: 0.9, detail: null,
    });
  }
  if (amenityRows.length > 0 && !DRY) {
    const { error: ae } = await db
      .from("gym_amenities")
      .upsert(amenityRows, { onConflict: "gym_id,amenity_key" });
    if (ae) throw new Error(`${g.slug} amenities: ${ae.message}`);
  }
  stats.amenities += amenityRows.length;

  // ── equipment: scraped wins; inherit missing numerics, flag in detail ──
  const eqIncoming = (Array.isArray(g.equipment) ? g.equipment : []).filter(
    (e) => EQUIPMENT_KEYS.has(e?.key),
  );
  if (eqIncoming.length > 0) {
    const { data: existing } = await db
      .from("gym_equipment")
      .select("equipment_key, brand, quantity, max_weight_lbs, source")
      .eq("gym_id", row.id);
    const byKey = new Map((existing ?? []).map((e) => [e.equipment_key, e]));
    const eqRows = [];
    const eqSeen = new Set();
    for (const e of eqIncoming) {
      if (eqSeen.has(e.key)) continue;
      eqSeen.add(e.key);
      const prev = byKey.get(e.key);
      if (prev && !canOverwrite("scraped", prev.source)) continue; // outranked — leave existing row untouched
      const inherited = [];
      let quantity = Number.isInteger(e.quantity) && e.quantity > 0 ? e.quantity : null;
      let maxW = Number.isInteger(e.max_weight_lbs) && e.max_weight_lbs > 0 ? e.max_weight_lbs : null;
      let brand = typeof e.brand === "string" && e.brand.length < 40 ? e.brand : null;
      if (quantity === null && prev?.quantity) { quantity = prev.quantity; inherited.push("count"); }
      if (maxW === null && prev?.max_weight_lbs) { maxW = prev.max_weight_lbs; inherited.push("max weight"); }
      if (brand === null && prev?.brand) { brand = prev.brand; inherited.push("brand"); }
      let detail = typeof e.detail === "string" ? e.detail.slice(0, 180) : null;
      if (inherited.length > 0 && prev?.source !== "scraped") {
        const note = `${inherited.join("/")} ${prev.source === "estimated" ? "estimated" : "from research"}`;
        detail = detail ? `${detail} · ${note}` : note;
      }
      eqRows.push({
        gym_id: row.id,
        equipment_key: e.key,
        brand,
        quantity,
        max_weight_lbs: maxW,
        source: "scraped",
        confidence: scrapedConfidence(g.slug),
        detail,
      });
    }
    if (!DRY && eqRows.length > 0) {
      // unique index is (gym_id, equipment_key) — delete+insert keeps ids tidy.
      // eqRows only ever contains keys that passed the canOverwrite guard
      // above, so this delete never touches a protected owner/scout_verified/
      // user row (its key never made it into `keys`).
      const keys = eqRows.map((r) => r.equipment_key);
      const { error: de } = await db
        .from("gym_equipment")
        .delete()
        .eq("gym_id", row.id)
        .in("equipment_key", keys);
      if (de) throw new Error(`${g.slug} equipment delete: ${de.message}`);
      const { error: ee } = await db.from("gym_equipment").insert(eqRows);
      if (ee) throw new Error(`${g.slug} equipment: ${ee.message}`);
    }
    stats.equipment += eqRows.length;
  }

  console.log(
    `  ✓ ${g.slug}${dp !== null ? ` · $${dp}` : ""}${hours ? " · hours" : ""}${photo ? " · photo" : ""}${amenityRows.length ? ` · ${amenityRows.length} amen` : ""}${eqIncoming.length ? ` · ${eqIncoming.length} equip` : ""}`,
  );
}

console.log(`\nDone. ${JSON.stringify(stats, null, 1)}`);
if (stats.skipped.length > 0) console.log("SKIPPED (no DB row):", stats.skipped);
