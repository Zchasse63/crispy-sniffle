/**
 * Scout parking intelligence pipeline.
 *
 * Stages:
 *   A  — structured gym-stated facts from data/parking-scrape.json (their own
 *        sites; source 'scraped', stale-risk slugs capped like enrich.mjs)
 *   A2 — strip-plaza inference for suburban corridor gyms with nothing stated
 *        (source 'estimated', clearly labeled — never presented as confirmed)
 *   B  — OpenStreetMap via Overpass: parking features near each gym, EDGE
 *        distance (polygon vertices, not centroids — big lots abut gyms while
 *        their centroids sit 200m away). Positives only; OSM absence proves
 *        nothing. Source 'osm', ODbL attribution rendered in UI.
 *   D  — primary recommendation ladder + gym_amenities.parking sync.
 *
 * Re-runnable: replace-per-gym. Usage: node scripts/parking-enrich.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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

const KINDS = new Set(["onsite_lot", "onsite_garage", "nearby_lot", "nearby_garage", "street", "valet"]);
const ACCESSES = new Set(["free", "customers", "validated", "paid", "permit", "unknown"]);
const STALE_RISK = new Set([
  "westshore-crossfit",
  "dale-mabry-crossfit",
  "9round-fitness-tampa-henderson-blvd",
]);
const PLAZA_CORRIDOR =
  /\b(Dale Mabry|Hillsborough Ave|Gandy Blvd|Fowler Ave|Gunn Hwy|Florida Ave|Henderson Blvd|Armenia Ave)\b/i;

const OVERPASS = "https://overpass-api.de/api/interpreter";
const TAMPA_BBOX = "27.65,-82.95,28.25,-82.25";
const OSM_MAX_M = 150;

const hav = (a, b, c, d) => {
  const r = Math.PI / 180;
  [a, b, c, d] = [a * r, b * r, c * r, d * r];
  return 2 * 6371000 * Math.asin(Math.sqrt(
    Math.sin((c - a) / 2) ** 2 + Math.cos(a) * Math.cos(c) * Math.sin((d - b) / 2) ** 2,
  ));
};

/* ── load gyms (Tampa only) ──────────────────────────────────────── */
const { data: tampa } = await db.from("cities").select("id").eq("slug", "tampa").single();
const { data: gyms, error: ge } = await db
  .from("gyms")
  .select("id, slug, name, address, lat, lng")
  .eq("city_id", tampa.id)
  .order("slug");
if (ge) throw ge;
const bySlug = new Map(gyms.map((g) => [g.slug, g]));

/* ── Stage A: gym-stated structured facts ────────────────────────── */
const rowsByGym = new Map(); // gym_id -> row[]
const push = (gymId, row) => {
  const list = rowsByGym.get(gymId) ?? [];
  list.push(row);
  rowsByGym.set(gymId, list);
};

const scrapePath = resolve(root, "data/parking-scrape.json");
let stageA = 0;
if (existsSync(scrapePath)) {
  const scrape = JSON.parse(readFileSync(scrapePath, "utf8"));
  for (const g of scrape) {
    const gym = bySlug.get(g.slug);
    if (!gym || !g.parking_found || !Array.isArray(g.facts)) continue;
    const conf = STALE_RISK.has(g.slug) ? 0.6 : 0.85;
    for (const f of g.facts) {
      if (!KINDS.has(f.kind)) continue;
      push(gym.id, {
        gym_id: gym.id,
        kind: f.kind,
        name: typeof f.name === "string" ? f.name.slice(0, 80) : null,
        distance_m: f.kind.startsWith("onsite") ? null : null, // gym-stated rows carry no measured distance
        access: ACCESSES.has(f.access) ? f.access : "unknown",
        fee_detail: typeof f.fee_detail === "string" ? f.fee_detail.slice(0, 120) : null,
        capacity: Number.isInteger(f.capacity) && f.capacity > 0 ? f.capacity : null,
        lat: null,
        lng: null,
        is_primary: false,
        source: "scraped",
        confidence: conf,
        detail: typeof f.detail === "string" ? f.detail.slice(0, 200) : null,
      });
      stageA++;
    }
  }
} else {
  console.log("(data/parking-scrape.json not found — Stage A skipped)");
}

/* ── Stage A2: strip-plaza inference (only when nothing stated) ──── */
let stageA2 = 0;
for (const gym of gyms) {
  if (rowsByGym.has(gym.id)) continue;
  if (gym.address && PLAZA_CORRIDOR.test(gym.address)) {
    push(gym.id, {
      gym_id: gym.id,
      kind: "onsite_lot",
      name: null,
      distance_m: null,
      access: "customers",
      fee_detail: null,
      capacity: null,
      lat: null,
      lng: null,
      is_primary: false,
      source: "estimated",
      confidence: 0.55,
      detail: "Strip-plaza location — customer parking expected",
    });
    stageA2++;
  }
}

/* ── Stage B: OpenStreetMap (Overpass, edge distance) ────────────── */
let stageB = 0;
try {
  const q = `[out:json][timeout:60];(node["amenity"="parking"](${TAMPA_BBOX});way["amenity"="parking"](${TAMPA_BBOX});relation["amenity"="parking"](${TAMPA_BBOX}););out tags geom 4000;`;
  const res = await fetch(OVERPASS, {
    method: "POST",
    body: "data=" + encodeURIComponent(q),
    headers: { "User-Agent": "ScoutGymBeta/0.1 (zchasse89@gmail.com)" },
    signal: AbortSignal.timeout(90000),
  });
  const data = await res.json();
  const els = (data.elements ?? []).map((el) => {
    let pts = [];
    if (el.type === "node") pts = [[el.lat, el.lon]];
    else if (el.geometry) pts = el.geometry.map((p) => [p.lat, p.lon]);
    else if (el.center) pts = [[el.center.lat, el.center.lon]];
    return { tags: el.tags ?? {}, pts };
  }).filter((e) => e.pts.length > 0);
  console.log(`Overpass: ${els.length} parking features in Tampa bbox`);

  for (const gym of gyms) {
    if (gym.lat === null || gym.lng === null) continue;
    const hits = [];
    for (const e of els) {
      let best = Infinity;
      for (const [plat, plng] of e.pts) {
        const d = hav(Number(gym.lat), Number(gym.lng), plat, plng);
        if (d < best) best = d;
      }
      if (best <= OSM_MAX_M) hits.push({ d: Math.round(best), tags: e.tags, pt: e.pts[0] });
    }
    hits.sort((a, b) => a.d - b.d);

    const existing = rowsByGym.get(gym.id) ?? [];
    const hasStatedOnsite = existing.some(
      (r) => r.source === "scraped" && r.kind.startsWith("onsite"),
    );
    let added = 0;
    for (const h of hits) {
      if (added >= 2) break;
      const t = h.tags;
      if (t.access === "private") continue;
      const isGarage = t.parking === "multi-storey" || t.parking === "underground";
      const kind = t.parking === "street_side" || t.parking === "on_street"
        ? "street"
        : isGarage ? "nearby_garage" : "nearby_lot";
      // skip OSM row that duplicates a gym-stated on-site facility
      if (hasStatedOnsite && h.d <= 60 && kind !== "street") continue;
      const access =
        t.access === "customers" ? "customers"
        : t.fee === "no" ? "free"
        : t.fee === "yes" ? "paid"
        : "unknown";
      const confidence =
        access === "customers" && h.d <= 80 ? 0.7
        : access === "free" && h.d <= 80 ? 0.65
        : 0.55;
      push(gym.id, {
        gym_id: gym.id,
        kind,
        name: t.name ? String(t.name).slice(0, 80) : null,
        distance_m: h.d,
        access,
        fee_detail: t.fee === "yes" && t.charge ? String(t.charge).slice(0, 60) : null,
        capacity: t.capacity && Number(t.capacity) > 0 && Number(t.capacity) < 5000
          ? Math.round(Number(t.capacity)) : null,
        lat: h.pt[0],
        lng: h.pt[1],
        is_primary: false,
        source: "osm",
        confidence,
        detail: `Mapped in OpenStreetMap${t.parking ? ` (${t.parking})` : ""}`,
      });
      added++;
      stageB++;
    }
  }
} catch (err) {
  console.log(`⚠ Overpass failed (${err.message}) — continuing with stages A/A2 only`);
}

/* ── Stage D: primary selection ladder ───────────────────────────── */
const ladder = (r) =>
  r.source === "scraped" && r.kind.startsWith("onsite") ? 0
  : r.source === "scraped" && r.access === "validated" ? 1
  : r.source === "scraped" && r.kind !== "street" ? 2
  : r.source === "osm" && r.access === "customers" && r.distance_m !== null && r.distance_m <= 80 ? 3
  : r.source === "osm" && r.access === "free" ? 4
  : r.source === "estimated" ? 5
  : r.source === "osm" ? 6
  : 7; // street / everything else

for (const [, rows] of rowsByGym) {
  rows.sort((a, b) => ladder(a) - ladder(b) || (a.distance_m ?? 0) - (b.distance_m ?? 0));
  rows.forEach((r, i) => (r.is_primary = i === 0));
}

/* ── write ───────────────────────────────────────────────────────── */
let gymsWithParking = 0;
for (const gym of gyms) {
  const rows = rowsByGym.get(gym.id) ?? [];
  if (rows.length === 0) continue;
  gymsWithParking++;
  if (!DRY) {
    const { error: de } = await db.from("gym_parking").delete().eq("gym_id", gym.id);
    if (de) throw new Error(`${gym.slug} delete: ${de.message}`);
    const { error: ie } = await db.from("gym_parking").insert(rows);
    if (ie) throw new Error(`${gym.slug} insert: ${ie.message}`);
    // sync the boolean filter surface (skip street/permit-only gyms).
    // Gym-stated tops upsert fully; OSM/estimated tops must never clobber
    // an existing (richer) amenity row — they only fill a true gap, at the
    // estimated tier (gym_amenities.source has no 'osm' value).
    if (rows.some((r) => r.access !== "permit" && r.kind !== "street")) {
      const top = rows[0];
      if (top.source === "scraped") {
        const { error: ae } = await db.from("gym_amenities").upsert(
          {
            gym_id: gym.id,
            amenity_key: "parking",
            present: true,
            source: "scraped",
            confidence: Math.min(top.confidence, 0.85),
            detail: top.detail,
          },
          { onConflict: "gym_id,amenity_key" },
        );
        if (ae) throw new Error(`${gym.slug} amenity sync: ${ae.message}`);
      } else {
        const { data: existing } = await db
          .from("gym_amenities")
          .select("amenity_key")
          .eq("gym_id", gym.id)
          .eq("amenity_key", "parking")
          .maybeSingle();
        if (!existing) {
          const { error: ae } = await db.from("gym_amenities").insert({
            gym_id: gym.id,
            amenity_key: "parking",
            present: true,
            source: "estimated",
            confidence: 0.55,
            detail: top.detail,
          });
          if (ae) throw new Error(`${gym.slug} amenity sync: ${ae.message}`);
        }
      }
    }
  }
  const p = rows[0];
  console.log(
    `  ✓ ${gym.slug}: ${rows.length} option${rows.length > 1 ? "s" : ""} · primary=${p.kind}/${p.access} (${p.source})`,
  );
}

console.log(
  `\nDone${DRY ? " (dry run)" : ""}. gyms_with_parking=${gymsWithParking}/${gyms.length} · stated=${stageA} plaza_inferred=${stageA2} osm=${stageB}`,
);
