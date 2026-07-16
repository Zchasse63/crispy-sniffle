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
import { rank, canOverwrite, SOURCE_RANK } from "./lib/provenance.mjs";

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

/* ── existing gym_parking rows, read BEFORE any delete ───────────────
 * gym_parking has no unique (gym_id, kind) key — multiple rows of the same
 * kind can legitimately coexist (e.g. two OSM nearby_lot hits at different
 * distances) — so provenance protection happens at the gym level in Stage
 * C.5 below, not per-row. Chunked to stay well under any .in() row-id cap
 * (Tampa is ~750 gyms; see "Metro scale limits" — a single .in() over gym
 * ids has broken prod before at this kind of scale). */
const existingByGym = new Map();
for (let i = 0; i < gyms.length; i += 200) {
  const chunkIds = gyms.slice(i, i + 200).map((g) => g.id);
  const { data: chunk, error: exErr } = await db
    .from("gym_parking")
    .select("id, gym_id, kind, name, distance_m, access, fee_detail, capacity, lat, lng, is_primary, source, confidence, detail")
    .in("gym_id", chunkIds);
  if (exErr) throw exErr;
  for (const r of chunk ?? []) {
    const list = existingByGym.get(r.gym_id) ?? [];
    list.push(r);
    existingByGym.set(r.gym_id, list);
  }
}

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

/* ── Stage C.5: partition existing rows against this run's incoming rows ──
 * Never overwrite/delete a higher-ranked existing fact. Since gym_parking
 * rows have no stable per-row key to match "this incoming row" against
 * "that existing row", the guard runs at the GYM level: an existing row is
 * PROTECTED only if its rank outranks the highest-ranked source this run is
 * about to write for that gym (never a blanket "owner always wins" — a
 * prior owner-tier row is still refreshable by a fresh owner-tier row
 * today, since canOverwrite treats equal rank as a refresh). Rows at or
 * below that ceiling are REPLACEABLE and may be deleted+reinserted. */
const protectedByGym = new Map(); // gym_id -> existing rows never touched this run
const replaceableByGym = new Map(); // gym_id -> existing row ids this run may delete
for (const [gymId, incomingRows] of rowsByGym) {
  const existing = existingByGym.get(gymId) ?? [];
  const maxIncomingRank = incomingRows.reduce((m, r) => Math.max(m, rank(r.source)), 0);
  protectedByGym.set(gymId, existing.filter((r) => rank(r.source) > maxIncomingRank));
  replaceableByGym.set(gymId, existing.filter((r) => rank(r.source) <= maxIncomingRank));
}

/* ── Stage D: primary selection ladder ───────────────────────────── */
const ladder = (r) =>
  rank(r.source) > SOURCE_RANK.scraped ? -rank(r.source) // owner/scout_verified/user — always wins
  : r.source === "scraped" && r.kind.startsWith("onsite") ? 0
  : r.source === "scraped" && r.access === "validated" ? 1
  : r.source === "scraped" && r.kind !== "street" ? 2
  : r.source === "osm" && r.access === "customers" && r.distance_m !== null && r.distance_m <= 80 ? 3
  : r.source === "osm" && r.access === "free" ? 4
  : r.source === "estimated" ? 5
  : r.source === "osm" ? 6
  : 7; // street / everything else

for (const [gymId, rows] of rowsByGym) {
  // Merge in protected existing rows for scoring/is_primary purposes only —
  // they carry a DB `id` and are never re-inserted (see write loop below).
  rows.push(...protectedByGym.get(gymId));
  rows.sort((a, b) => ladder(a) - ladder(b) || (a.distance_m ?? 0) - (b.distance_m ?? 0));
  rows.forEach((r, i) => (r.is_primary = i === 0));
}

/* ── write ───────────────────────────────────────────────────────── */
let gymsWithParking = 0;
let protectedRowsKept = 0;
for (const gym of gyms) {
  const rows = rowsByGym.get(gym.id) ?? [];
  if (rows.length === 0) continue;
  gymsWithParking++;
  // Rows fetched from the DB (protected, merged in above) carry an `id`;
  // this run's freshly-built rows never do — that's the discriminator
  // between "already exists, never re-insert" and "new, insert now".
  const freshRows = rows.filter((r) => r.id === undefined);
  const protectedRows = rows.filter((r) => r.id !== undefined);
  protectedRowsKept += protectedRows.length;
  if (!DRY) {
    const replaceableIds = (replaceableByGym.get(gym.id) ?? []).map((r) => r.id);
    if (replaceableIds.length > 0) {
      const { error: de } = await db.from("gym_parking").delete().in("id", replaceableIds);
      if (de) throw new Error(`${gym.slug} delete: ${de.message}`);
    }
    if (freshRows.length > 0) {
      const { error: ie } = await db.from("gym_parking").insert(freshRows);
      if (ie) throw new Error(`${gym.slug} insert: ${ie.message}`);
    }
    // Protected rows may have a new is_primary after the merged sort above —
    // patch ONLY that column; nothing else on a protected row is ever
    // touched by this loader.
    for (const r of protectedRows) {
      const { error: pe } = await db.from("gym_parking").update({ is_primary: r.is_primary }).eq("id", r.id);
      if (pe) throw new Error(`${gym.slug} primary patch: ${pe.message}`);
    }
    // sync the boolean filter surface (skip street/permit-only gyms).
    // Reflects whatever actually won the primary-selection ladder above
    // (which may now be a protected owner/scout_verified/user/scraped row,
    // not just this run's own scraped/osm/estimated output) — and never
    // clobbers a higher-ranked existing gym_amenities.parking fact.
    if (rows.some((r) => r.access !== "permit" && r.kind !== "street")) {
      const top = rows[0];
      const { data: existingParkingAmenity } = await db
        .from("gym_amenities")
        .select("source")
        .eq("gym_id", gym.id)
        .eq("amenity_key", "parking")
        .maybeSingle();
      if (canOverwrite(top.source, existingParkingAmenity?.source)) {
        const { error: ae } = await db.from("gym_amenities").upsert(
          {
            gym_id: gym.id,
            amenity_key: "parking",
            present: true,
            source: top.source,
            confidence: top.source === "scraped" ? Math.min(Number(top.confidence), 0.85) : Number(top.confidence ?? 0.55),
            detail: top.detail,
          },
          { onConflict: "gym_id,amenity_key" },
        );
        if (ae) throw new Error(`${gym.slug} amenity sync: ${ae.message}`);
      }
    }
  }
  const p = rows[0];
  console.log(
    `  ✓ ${gym.slug}: ${rows.length} option${rows.length > 1 ? "s" : ""} · primary=${p.kind}/${p.access} (${p.source})`,
  );
}

console.log(
  `\nDone${DRY ? " (dry run)" : ""}. gyms_with_parking=${gymsWithParking}/${gyms.length} · stated=${stageA} plaza_inferred=${stageA2} osm=${stageB} · protected_existing=${protectedRowsKept}`,
);
