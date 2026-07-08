// Metro-expansion EXTRACTION core + Tampa-holdout ACCEPTANCE TEST (pipeline doc
// build rule #1). Fetch a gym's website -> Haiku extract structured facts against
// our taxonomy -> diff vs our shipped ground truth to measure precision/recall.
// This is a VALIDATION run: it never writes to the DB (the Tampa data is the truth).
//
//   node scripts/extract.mjs            # 6-gym default holdout
//   node scripts/extract.mjs --gyms bayshore-fit,camp-tampa
//
// Needs .env.local with SUPABASE_SERVICE_ROLE_KEY (reads ground truth + the
// Anthropic key from Vault via get_secret, same as vision-enrich.mjs).
import { readFileSync } from "node:fs";
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
} catch {
  /* rely on process.env */
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}
const db = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });

const AMENITY_VOCAB = [
  "basketball_court", "cafe", "cardio_zone", "childcare", "classes", "cold_plunge", "day_pass",
  "juice_bar", "lockers", "open_24h", "parking", "personal_training", "pool", "recovery_room",
  "sauna", "showers", "steam_room", "towel_service", "turf_area", "wifi", "womens_area", "womens_only",
];
const EQUIPMENT_VOCAB = [
  "squat_rack", "power_rack", "platform", "dumbbells", "barbells", "kettlebells", "ghd", "sled",
  "ski_erg", "assault_bike", "rower", "reverse_hyper", "belt_squat", "comp_bench", "cable_machine",
  "leg_press", "smith_machine", "hack_squat", "pull_up_bar", "monolift", "climbing_wall",
  "leg_extension", "leg_curl", "abductor_adductor", "stepmill", "specialty_bars",
];

const argGyms = (process.argv.find((a) => a.startsWith("--gyms=")) || "").split("=")[1];

// ── fetch: Jina Reader (clean markdown, renders JS) with a plain-fetch fallback ──
async function fetchPage(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 30000);
  try {
    const jina = await fetch(`https://r.jina.ai/${url}`, {
      signal: ctrl.signal,
      headers: { "x-return-format": "markdown" },
    });
    if (jina.ok) {
      const md = await jina.text();
      if (md && md.length > 200) return md;
    }
    const raw = await fetch(url, { signal: ctrl.signal, headers: { "user-agent": "Mozilla/5.0 ScoutBot" } });
    if (!raw.ok) return null;
    const html = await raw.text();
    return html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

async function fetchSite(website) {
  const base = website.replace(/\/$/, "");
  const paths = ["", "/membership", "/memberships", "/amenities", "/about", "/pricing"];
  const seen = new Set();
  const chunks = [];
  for (const p of paths) {
    if (chunks.join("").length > 16000) break;
    const md = await fetchPage(base + p);
    if (md && !seen.has(md.slice(0, 120))) {
      seen.add(md.slice(0, 120));
      chunks.push(`# ${p || "/"}\n${md.slice(0, 6000)}`);
    }
  }
  return chunks.join("\n\n").slice(0, 18000);
}

// ── Haiku extraction against our taxonomy ──
async function extract(name, content, key) {
  const system =
    `You extract gym facts from website text into STRICT JSON. Never guess — omit anything not clearly stated.\n` +
    `amenities: array, ONLY these keys the site clearly offers: ${AMENITY_VOCAB.join(", ")}.\n` +
    `equipment: array, ONLY these keys clearly present: ${EQUIPMENT_VOCAB.join(", ")}.\n` +
    `day_pass_price: number (USD) or null. hours: {mon..sun: ["HH:MM","HH:MM"]} or null. ` +
    `phone: string or null. description: 1-2 sentence factual summary or null.\n` +
    `Output ONLY the JSON object, no prose.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 1500,
      system,
      messages: [{ role: "user", content: `Gym: ${name}\n\nWebsite content:\n${content}` }],
    }),
  });
  if (!res.ok) return { error: `anthropic ${res.status}` };
  const j = await res.json();
  const text = j.content?.[0]?.text ?? "";
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return { error: "no-json" };
  try {
    return { data: JSON.parse(m[0]) };
  } catch {
    return { error: "bad-json" };
  }
}

function prf(extractedArr, truthSet) {
  const ex = new Set((extractedArr || []).filter((k) => truthSet.size >= 0));
  let hit = 0;
  for (const k of ex) if (truthSet.has(k)) hit++;
  return { ex: ex.size, truth: truthSet.size, hit };
}

// ── ground truth + run ──
const slugs = argGyms
  ? argGyms.split(",")
  : ["813-barbell", "amped-fitness-carrollwood", "anytime-fitness-carrollwood", "bayshore-fit", "camp-tampa", "central-rock-gym-citrus-park"];

const { data: gyms } = await db
  .from("gyms")
  .select("id, slug, name, website, hours, day_pass_price, description")
  .in("slug", slugs);

console.log(`ACCEPTANCE TEST — extracting ${gyms.length} Tampa gyms, diffing vs shipped ground truth\n`);
const anthropicKey = (await db.rpc("get_secret", { secret_name: "ANTHROPIC_API_KEY" })).data;
if (!anthropicKey) {
  console.error("Could not read ANTHROPIC_API_KEY from Vault (get_secret)");
  process.exit(1);
}

const agg = { am: { ex: 0, truth: 0, hit: 0 }, eq: { ex: 0, truth: 0, hit: 0 }, hoursHit: 0, hoursTruth: 0, dayHit: 0, dayTruth: 0, descHit: 0 };
for (const g of gyms) {
  const [{ data: amRows }, { data: eqRows }] = await Promise.all([
    db.from("gym_amenities").select("amenity_key").eq("gym_id", g.id).eq("present", true),
    db.from("gym_equipment").select("equipment_key").eq("gym_id", g.id),
  ]);
  const truthAm = new Set(amRows.map((r) => r.amenity_key).filter((k) => AMENITY_VOCAB.includes(k)));
  const truthEq = new Set(eqRows.map((r) => r.equipment_key));

  const content = await fetchSite(g.website);
  if (!content || content.length < 300) {
    console.log(`  ${g.slug}: FETCH FAILED (${content?.length ?? 0} chars)`);
    continue;
  }
  const out = await extract(g.name, content, anthropicKey);
  if (out.error) {
    console.log(`  ${g.slug}: EXTRACT FAILED (${out.error})`);
    continue;
  }
  const e = out.data;
  const am = prf(e.amenities, truthAm);
  const eq = prf(e.equipment, truthEq);
  agg.am.ex += am.ex; agg.am.truth += am.truth; agg.am.hit += am.hit;
  agg.eq.ex += eq.ex; agg.eq.truth += eq.truth; agg.eq.hit += eq.hit;
  if (g.hours) { agg.hoursTruth++; if (e.hours && Object.keys(e.hours).length) agg.hoursHit++; }
  if (g.day_pass_price != null) { agg.dayTruth++; if (e.day_pass_price != null && Math.abs(Number(e.day_pass_price) - Number(g.day_pass_price)) <= 5) agg.dayHit++; }
  if (g.description && e.description) agg.descHit++;

  console.log(
    `  ${g.slug}: amenities ${am.hit}/${am.truth} recalled (${am.ex} extracted) · ` +
    `equipment ${eq.hit}/${eq.truth} · hours ${e.hours ? "✓" : "✗"} · ` +
    `daypass ${e.day_pass_price ?? "–"}${g.day_pass_price ? `/truth ${g.day_pass_price}` : ""}`,
  );
}

const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
console.log(`\n=== AGGREGATE (micro-averaged over ${gyms.length} gyms) ===`);
console.log(`  amenities: recall ${pct(agg.am.hit, agg.am.truth)}% (${agg.am.hit}/${agg.am.truth}), precision ${pct(agg.am.hit, agg.am.ex)}% (${agg.am.hit}/${agg.am.ex})`);
console.log(`  equipment: recall ${pct(agg.eq.hit, agg.eq.truth)}% (${agg.eq.hit}/${agg.eq.truth}), precision ${pct(agg.eq.hit, agg.eq.ex)}% (${agg.eq.hit}/${agg.eq.ex})`);
console.log(`  hours found: ${pct(agg.hoursHit, agg.hoursTruth)}% (${agg.hoursHit}/${agg.hoursTruth})`);
console.log(`  day-pass within $5: ${pct(agg.dayHit, agg.dayTruth)}% (${agg.dayHit}/${agg.dayTruth})`);
console.log(`  description found: ${pct(agg.descHit, gyms.length)}% (${agg.descHit}/${gyms.length})`);
