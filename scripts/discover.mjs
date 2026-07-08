// Metro-expansion Stage 1 — DISCOVERY. Pull the fitness facility master list for a
// metro from Overture Maps (free, CDLA-Permissive) via DuckDB, normalize + dedupe +
// rule-based segment pre-classification, and upsert to facility_candidates ($0).
//
//   DUCKDB=/path/to/duckdb node scripts/discover.mjs --metro=miami
//
// Needs: a duckdb binary (env DUCKDB or `duckdb` in PATH) + .env.local service key.
// Overture is public S3 (us-west-2), no credentials.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { execFileSync } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* env */ }

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const DUCKDB = env.DUCKDB || "duckdb";
const RELEASE = env.OVERTURE_RELEASE || "2026-05-20.0"; // update to the latest monthly release
const metro = (process.argv.find((a) => a.startsWith("--metro=")) || "--metro=miami").split("=")[1];

// Metro bboxes (xmin,xmax,ymin,ymax). Add metros here.
const METROS = {
  miami: { xmin: -80.9, xmax: -80.0, ymin: 25.5, ymax: 26.1 },
  tampa: { xmin: -82.85, xmax: -82.2, ymin: 27.6, ymax: 28.2 },
};
const CATEGORIES = [
  "gym", "fitness_center", "martial_arts_club", "yoga_studio", "pilates_studio",
  "climbing_gym", "boxing_gym", "crossfit_box",
];

const bb = METROS[metro];
if (!bb) { console.error(`Unknown metro '${metro}'. Known: ${Object.keys(METROS).join(", ")}`); process.exit(1); }

// Rule-based segment pre-classification (SOFT per Kodawari — AI/equipment refine later).
function classifySegment(category, name) {
  const n = (name || "").toLowerCase();
  if (category === "yoga_studio" || category === "pilates_studio") return /barre/.test(n) ? "barre" : "yoga_pilates";
  if (category === "martial_arts_club" || category === "boxing_gym") return "mma";
  if (category === "climbing_gym") return "climbing";
  if (category === "crossfit_box") return "crossfit";
  if (/\bcrossfit\b|cross ?fit|\bwod\b/.test(n)) return "crossfit";
  if (/barbell|powerlifting|weightlifting|strength|\biron\b/.test(n)) return "strength";
  if (/life ?time|equinox/.test(n)) return "luxury";
  if (/planet fitness|la fitness|crunch|24 ?hour|ymca|youfit|blink|esporta|\beos\b|anytime fitness/.test(n)) return "big_box";
  if (/orange ?theory|\bf45\b|barry|burn boot|\bhiit\b/.test(n)) return "boutique";
  if (/cycle|\bspin\b|soulcycle|cyclebar/.test(n)) return "cycling";
  if (/\bbarre\b/.test(n)) return "barre";
  if (/recovery|cryo|cold ?plunge/.test(n)) return "recovery";
  return null;
}

const cats = CATEGORIES.map((c) => `'${c}'`).join(",");
const query = `
INSTALL httpfs; LOAD httpfs; SET s3_region='us-west-2';
SELECT id AS overture_id, names.primary AS name, categories.primary AS category,
  categories.alternate AS categories_alt, confidence,
  websites, socials, phones,
  round(bbox.xmin,6) AS lng, round(bbox.ymin,6) AS lat,
  addresses[1].freeform AS address, addresses[1].locality AS locality,
  addresses[1].region AS region, addresses[1].postcode AS postcode
FROM read_parquet('s3://overturemaps-us-west-2/release/${RELEASE}/theme=places/type=place/*.parquet', hive_partitioning=1)
WHERE bbox.xmin BETWEEN ${bb.xmin} AND ${bb.xmax}
  AND bbox.ymin BETWEEN ${bb.ymin} AND ${bb.ymax}
  AND categories.primary IN (${cats})
  AND confidence >= 0.5;`;

console.log(`Discovering ${metro} fitness facilities from Overture ${RELEASE}...`);
let rows;
try {
  const out = execFileSync(DUCKDB, ["-json", "-c", query], { maxBuffer: 256 * 1024 * 1024 }).toString();
  rows = JSON.parse(out || "[]");
} catch (e) {
  console.error("DuckDB query failed:", String(e.message || e).slice(0, 200));
  process.exit(1);
}
console.log(`  Overture returned ${rows.length} candidates (confidence >= 0.5)`);

const firstUrl = (list) => (Array.isArray(list) && list.length ? String(list[0]) : null);
const instagram = (socials) =>
  (Array.isArray(socials) ? socials.find((s) => /instagram\.com/i.test(s)) : null) || null;

const records = rows.map((r) => ({
  overture_id: r.overture_id,
  metro,
  name: r.name,
  segment: classifySegment(r.category, r.name),
  category: r.category,
  categories: { primary: r.category, alternate: r.categories_alt ?? [] },
  address: r.address ?? null,
  locality: r.locality ?? null,
  region: r.region ?? null,
  postcode: r.postcode ?? null,
  lat: r.lat ?? null,
  lng: r.lng ?? null,
  website: firstUrl(r.websites),
  websites: r.websites ?? [],
  socials: { all: r.socials ?? [], instagram: instagram(r.socials) },
  phone: firstUrl(r.phones),
  confidence: r.confidence ?? null,
  status: "candidate",
  updated_at: new Date().toISOString(),
}));

let upserted = 0;
for (let i = 0; i < records.length; i += 500) {
  const chunk = records.slice(i, i + 500);
  const { error } = await db.from("facility_candidates").upsert(chunk, { onConflict: "overture_id" });
  if (error) { console.error("upsert error:", error.message); process.exit(1); }
  upserted += chunk.length;
}

const withWeb = records.filter((r) => r.website).length;
const bySeg = {};
for (const r of records) bySeg[r.segment ?? "unclassified"] = (bySeg[r.segment ?? "unclassified"] || 0) + 1;
console.log(`  Upserted ${upserted} candidates (${withWeb} with website, ${Math.round((100 * withWeb) / upserted)}%)`);
console.log(`  Segments: ${Object.entries(bySeg).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s} ${n}`).join(", ")}`);
