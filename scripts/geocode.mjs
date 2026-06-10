/**
 * Scout coordinate correction — replaces seed-era ~3-decimal coordinates
 * (measured off by 500–1200m in probes) with validated geocodes.
 *
 * Method: US Census geocoder (free, public domain, authoritative for US
 * street addresses) cross-checked against Nominatim (OSM). A correction is
 * applied only when BOTH geocoders agree within AGREE_M meters; otherwise
 * the gym is flagged for manual review and left untouched.
 *
 * Usage: node scripts/geocode.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");
const AGREE_M = 200; // geocoder consensus radius
const MIN_MOVE_M = 60; // don't churn rows for sub-noise moves
const MAX_MOVE_M = 3000; // plausibility cap: seeds are city-correct; bigger moves
                         // mean BOTH geocoders matched the wrong city (it happened:
                         // Denver and Oklahoma City). Reject and flag instead.
const TIEBREAK_M = 800; // moderate disagreement: trust Census when it returned
                        // an exact street-number match for our input address

for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hav = (a, b, c, d) => {
  const r = Math.PI / 180;
  [a, b, c, d] = [a * r, b * r, c * r, d * r];
  return (
    2 *
    6371000 *
    Math.asin(
      Math.sqrt(
        Math.sin((c - a) / 2) ** 2 +
          Math.cos(a) * Math.cos(c) * Math.sin((d - b) / 2) ** 2,
      ),
    )
  );
};

async function census(address) {
  const url =
    "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?" +
    new URLSearchParams({
      address,
      benchmark: "Public_AR_Current",
      format: "json",
    });
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const data = await res.json();
  const m = data?.result?.addressMatches?.[0];
  return m
    ? { lat: m.coordinates.y, lng: m.coordinates.x, matched: m.matchedAddress ?? "" }
    : null;
}

async function nominatim(address) {
  const url =
    "https://nominatim.openstreetmap.org/search?" +
    new URLSearchParams({ q: address, format: "json", limit: "1", countrycodes: "us" });
  const res = await fetch(url, {
    headers: { "User-Agent": "ScoutGymBeta/0.1 (zchasse89@gmail.com)" },
    signal: AbortSignal.timeout(30000),
  });
  const data = await res.json();
  return data?.[0] ? { lat: Number(data[0].lat), lng: Number(data[0].lon) } : null;
}

const { data: gyms, error } = await db
  .from("gyms")
  .select("id, slug, name, address, lat, lng")
  .not("address", "is", null)
  .order("slug");
if (error) throw error;

console.log(`${gyms.length} gyms with addresses · ${DRY ? "DRY RUN" : "writing"}\n`);
const stats = { corrected: 0, agreed_close: 0, flagged: [], no_match: [] };

for (const g of gyms) {
  const addr = `${g.address.replace(/\s*Suite.*$|\s*Ste\.?\s.*$|\s*#.*$/i, "")}`;
  const c = await census(addr);
  await sleep(400);
  const n = await nominatim(addr);
  await sleep(1100); // Nominatim usage policy: ≤1 req/s

  if (!c && !n) {
    stats.no_match.push(g.slug);
    console.log(`  ✗ ${g.slug}: no geocoder match`);
    continue;
  }
  let pick = null;
  const streetNum = (g.address.match(/^\d+/) || [""])[0];
  const censusExact = c && streetNum && c.matched.startsWith(streetNum + " ");
  if (c && n) {
    const agree = hav(c.lat, c.lng, n.lat, n.lng);
    if (agree <= AGREE_M) pick = c; // consensus → trust Census point
    else if (agree <= TIEBREAK_M && censusExact) {
      pick = c; // moderate disagreement, Census matched our exact street number
      console.log(`  ~ ${g.slug}: disagreement ${Math.round(agree)}m, Census exact match wins`);
    } else {
      stats.flagged.push(`${g.slug} (geocoders disagree by ${Math.round(agree)}m)`);
      console.log(`  ⚠ ${g.slug}: census/nominatim disagree ${Math.round(agree)}m — left as-is`);
      continue;
    }
  } else pick = c ?? n; // single-source: accept but it's Census-or-OSM only

  // plausibility cap — geocoders can both match the wrong city
  if (g.lat !== null && hav(g.lat, g.lng, pick.lat, pick.lng) > MAX_MOVE_M) {
    stats.flagged.push(`${g.slug} (implausible ${Math.round(hav(g.lat, g.lng, pick.lat, pick.lng) / 1000)}km move)`);
    console.log(`  ⚠ ${g.slug}: implausible move — left as-is`);
    continue;
  }

  const moved = g.lat !== null ? Math.round(hav(g.lat, g.lng, pick.lat, pick.lng)) : null;
  if (moved !== null && moved < MIN_MOVE_M) {
    stats.agreed_close++;
    console.log(`  · ${g.slug}: already accurate (${moved}m)`);
    continue;
  }
  if (!DRY) {
    const { error: ue } = await db
      .from("gyms")
      .update({ lat: Number(pick.lat.toFixed(6)), lng: Number(pick.lng.toFixed(6)) })
      .eq("id", g.id);
    if (ue) throw new Error(`${g.slug}: ${ue.message}`);
  }
  stats.corrected++;
  console.log(`  ✓ ${g.slug}: moved ${moved}m → (${pick.lat.toFixed(5)}, ${pick.lng.toFixed(5)})`);
}

console.log(`\nDone. corrected=${stats.corrected} already_accurate=${stats.agreed_close}`);
if (stats.flagged.length) console.log("FLAGGED:", stats.flagged);
if (stats.no_match.length) console.log("NO MATCH:", stats.no_match);
