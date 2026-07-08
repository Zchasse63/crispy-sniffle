// Vision-stage acceptance test: does Haiku VISION over a gym's facility photos
// recover the equipment ground truth that website-TEXT extraction missed (7%)?
// Read-only; runs on the same Tampa holdout. Uses the rehosted Storage photos.
//
//   node scripts/vision-accept.mjs
//   node scripts/vision-accept.mjs --gyms=bayshore-fit,central-rock-gym-tampa
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
  /* env */
}
const SUPA_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPA_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const db = createClient(SUPA_URL, SERVICE_KEY, { auth: { persistSession: false } });

const EQUIPMENT_VOCAB = [
  "squat_rack", "power_rack", "platform", "dumbbells", "barbells", "kettlebells", "ghd", "sled",
  "ski_erg", "assault_bike", "rower", "reverse_hyper", "belt_squat", "comp_bench", "cable_machine",
  "leg_press", "smith_machine", "hack_squat", "pull_up_bar", "monolift", "climbing_wall",
  "leg_extension", "leg_curl", "abductor_adductor", "stepmill", "specialty_bars",
];

const argGyms = (process.argv.find((a) => a.startsWith("--gyms=")) || "").split("=")[1];
const slugs = argGyms
  ? argGyms.split(",")
  : ["813-barbell", "amped-fitness-carrollwood", "anytime-fitness-carrollwood", "bayshore-fit", "camp-tampa", "central-rock-gym-citrus-park"];

const objUrl = (p) => `${SUPA_URL.replace(/\/$/, "")}/storage/v1/object/public/gym-photos/${encodeURI(p)}`;

async function visionEquipment(name, imageUrls, key) {
  const system =
    `You are auditing GYM FACILITY PHOTOS for strength/conditioning equipment. List ONLY equipment keys that are CLEARLY VISIBLE in the photos — never guess from context.\n` +
    `Allowed keys: ${EQUIPMENT_VOCAB.join(", ")}.\n` +
    `Output ONLY JSON: {"equipment": ["key", ...]}.`;
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model: "claude-haiku-4-5",
      max_tokens: 600,
      temperature: 0,
      system,
      messages: [{
        role: "user",
        content: [
          ...imageUrls.map((url) => ({ type: "image", source: { type: "url", url } })),
          { type: "text", text: `${imageUrls.length} facility photos for "${name}". Which equipment keys are visible?` },
        ],
      }],
    }),
    signal: AbortSignal.timeout(60000),
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

const anthropicKey = (await db.rpc("get_secret", { secret_name: "ANTHROPIC_API_KEY" })).data;
if (!anthropicKey) {
  console.error("Could not read ANTHROPIC_API_KEY from Vault");
  process.exit(1);
}

const { data: gyms } = await db.from("gyms").select("id, slug, name").in("slug", slugs);
console.log(`VISION ACCEPTANCE — equipment recall from facility photos, ${gyms.length} gyms\n`);

const agg = { ex: 0, truth: 0, hit: 0, gymsWithPhotos: 0 };
for (const g of gyms) {
  const [{ data: photos }, { data: eqRows }] = await Promise.all([
    db.from("gym_photos").select("url, storage_path").eq("gym_id", g.id).limit(5),
    db.from("gym_equipment").select("equipment_key").eq("gym_id", g.id),
  ]);
  const truth = new Set(eqRows.map((r) => r.equipment_key));
  const urls = (photos ?? []).map((p) => (p.storage_path ? objUrl(p.storage_path) : p.url)).filter(Boolean);
  if (urls.length === 0) {
    console.log(`  ${g.slug}: no photos — skipped (truth ${truth.size})`);
    continue;
  }
  agg.gymsWithPhotos++;
  const out = await visionEquipment(g.name, urls, anthropicKey);
  if (out.error) {
    console.log(`  ${g.slug}: VISION FAILED (${out.error})`);
    continue;
  }
  const ex = new Set((out.data.equipment || []).filter((k) => EQUIPMENT_VOCAB.includes(k)));
  let hit = 0;
  for (const k of ex) if (truth.has(k)) hit++;
  agg.ex += ex.size; agg.truth += truth.size; agg.hit += hit;
  console.log(`  ${g.slug}: equipment ${hit}/${truth.size} recalled (${ex.size} seen, ${urls.length} photos) — [${[...ex].join(", ")}]`);
}

const pct = (n, d) => (d ? Math.round((100 * n) / d) : 0);
console.log(`\n=== VISION EQUIPMENT (micro-avg over ${agg.gymsWithPhotos} gyms with photos) ===`);
console.log(`  recall ${pct(agg.hit, agg.truth)}% (${agg.hit}/${agg.truth}), precision ${pct(agg.hit, agg.ex)}% (${agg.hit}/${agg.ex})`);
console.log(`  (text-only extraction was 7% recall — this measures the vision lift)`);
