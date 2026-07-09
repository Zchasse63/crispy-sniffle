// Prepare args for the Tampa quality-audit workflow: compute the flagged set
// (junk-name / thin / ugly-name / segment-mismatch / no-segment), a random precision
// sample, and proximity dup pairs. Writes compact JSON to the path in argv[2].
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const env = { ...process.env };
try {
  for (const line of readFileSync(join(root, ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !env[m[1]]) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch { /* env */ }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const OUT = process.argv[2] || join(root, "audit-args.json");
const CITY = "c49bc7b1-7c4a-48b9-8b4e-057ccf7ae6ae";

const page = async (tbl, cols, filt) => {
  let all = [], from = 0;
  for (;;) {
    let q = db.from(tbl).select(cols).range(from, from + 999);
    if (filt) q = filt(q);
    const { data, error } = await q;
    if (error) throw error;
    all = all.concat(data);
    if (data.length < 1000) break;
    from += 1000;
  }
  return all;
};

const gyms = await page("gyms", "id,name,website,address,neighborhood,segment,lat,lng", (q) => q.eq("city_id", CITY));
const landed = await page("facility_candidates", "gym_id,overture_id", (q) => q.eq("metro", "tampa").eq("status", "landed").not("gym_id", "is", null));
const pipelineIds = new Set(landed.map((r) => r.gym_id));
const oidByGym = new Map(landed.map((r) => [r.gym_id, r.overture_id]));
const amRows = await page("gym_amenities", "gym_id,amenity_key");
const eqRows = await page("gym_equipment", "gym_id,equipment_key");
const amBy = new Map(), eqBy = new Map();
for (const r of amRows) { if (!amBy.has(r.gym_id)) amBy.set(r.gym_id, []); amBy.get(r.gym_id).push(r.amenity_key); }
for (const r of eqRows) { if (!eqBy.has(r.gym_id)) eqBy.set(r.gym_id, []); eqBy.get(r.gym_id).push(r.equipment_key); }

const JUNK = /(nutrition|supplement|chiropract|physical therapy|\brehab\b|med ?spa|\bsalon\b|tan(ning)?\b|\bmassage\b|gaming|\bdance\b|gymnastics|\bcheer\b|\bchurch\b|realty|insurance|\bshop\b|\bstore\b)/i;
const MMA = /(jiu.?jitsu|\bbjj\b|\bmma\b|boxing|muay|karate|taekwon|martial|kickbox)/i;

const flagged = [], sampleCand = [];
for (const g of gyms) {
  if (!pipelineIds.has(g.id)) continue;
  const am = amBy.get(g.id) || [], eq = eqBy.get(g.id) || [];
  const reasons = [];
  if (JUNK.test(g.name)) reasons.push("junk-name-suspect");
  if (!am.length && !eq.length && !g.hours) reasons.push("thin-desc-only");
  if (!/ /.test(g.name) && g.name.length > 10) reasons.push("ugly-name");
  if (MMA.test(g.name) && g.segment !== "mma") reasons.push("seg-mismatch-mma");
  if (!g.segment) reasons.push("no-segment");
  if (reasons.length) {
    flagged.push({ id: g.id, oid: oidByGym.get(g.id), name: g.name, website: g.website, segment: g.segment, reason: reasons.join(",") });
  } else if (am.length >= 3) {
    sampleCand.push({ id: g.id, oid: oidByGym.get(g.id), name: g.name, website: g.website, amenities: am, equipment: eq });
  }
}

// Deterministic "random" sample (no Math.random): every Nth well-populated gym.
const step = Math.max(1, Math.floor(sampleCand.length / 40));
const sample = sampleCand.filter((_, i) => i % step === 0).slice(0, 40);

// Proximity dup pairs among all Tampa gyms (<120m), at least one pipeline-landed.
const haversine = (a, b, c, d) => {
  const R = 6371000, r = Math.PI / 180;
  const dLa = (c - a) * r, dLo = (d - b) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const withCoord = gyms.filter((g) => Number.isFinite(Number(g.lat)) && Number.isFinite(Number(g.lng)));
const dupPairs = [];
for (let i = 0; i < withCoord.length; i++) {
  for (let j = i + 1; j < withCoord.length; j++) {
    const A = withCoord[i], B = withCoord[j];
    if (!pipelineIds.has(A.id) && !pipelineIds.has(B.id)) continue;
    const dist = haversine(Number(A.lat), Number(A.lng), Number(B.lat), Number(B.lng));
    if (dist < 120) {
      dupPairs.push({ dist: Math.round(dist),
        a: { id: A.id, name: A.name, website: A.website },
        b: { id: B.id, name: B.name, website: B.website } });
    }
  }
}

writeFileSync(OUT, JSON.stringify({ flagged, sample, dupPairs }));
console.log(`flagged=${flagged.length} sample=${sample.length} dupPairs=${dupPairs.length} -> ${OUT}`);
console.log(`bytes=${JSON.stringify({ flagged, sample, dupPairs }).length}`);
