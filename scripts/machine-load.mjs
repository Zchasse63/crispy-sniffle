/** P2-D machine loader: data/machine-scrape.json → gym_equipment.
 *  Gym-published facts (scraped 0.85) override estimated rows per key;
 *  never touch existing scraped rows except to ENRICH null brand/qty/max. */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { canOverwrite } from "./lib/provenance.mjs";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const VALID = new Set(["stepmill","hip_thrust","leg_curl","leg_extension","hack_squat","belt_squat","leg_press","cable_machine","smith_machine","dumbbells","ghd","reverse_hyper","nordic_bench","platform","specialty_bars","calf_machine","abductor_adductor"]);
// agent variants → canonical keys
const KEYMAP = { leg_curl_seated: "leg_curl", leg_curl_lying: "leg_curl", leg_curl_standing: "leg_curl", lateral_raise_machine: null, pendulum_squat: null };
const data = JSON.parse(readFileSync(resolve(root, "data/machine-scrape.json"), "utf8"));
let upserts = 0, enriched = 0;
for (const g of data) {
  const { data: gym } = await db.from("gyms").select("id").eq("slug", g.slug).maybeSingle();
  if (!gym) { console.log(`  ✗ ${g.slug}: no gym row`); continue; }
  const { data: existing } = await db.from("gym_equipment").select("equipment_key, brand, quantity, max_weight_lbs, source").eq("gym_id", gym.id);
  const byKey = new Map((existing ?? []).map((e) => [e.equipment_key, e]));
  for (const f of g.found ?? []) {
    const key = KEYMAP[f.key] === undefined ? f.key : KEYMAP[f.key];
    if (!key || !VALID.has(key)) continue;
    const prev = byKey.get(key);
    if (prev && !canOverwrite("scraped", prev.source)) {
      console.log(`  · ${g.slug}/${key}: skipped (existing '${prev.source}' outranks scraped)`);
      continue;
    }
    const row = {
      gym_id: gym.id, equipment_key: key,
      brand: typeof f.brand === "string" && f.brand.length < 40 ? f.brand : prev?.brand ?? null,
      quantity: Number.isInteger(f.quantity) && f.quantity > 0 ? f.quantity : prev?.quantity ?? null,
      max_weight_lbs: Number.isInteger(f.max_weight_lbs) && f.max_weight_lbs > 0 ? f.max_weight_lbs : prev?.max_weight_lbs ?? null,
      source: "scraped", confidence: 0.85,
      detail: typeof f.detail === "string" ? f.detail.slice(0, 180) : null,
    };
    if (prev && prev.source === "scraped" && !f.brand && !f.quantity && !f.max_weight_lbs) {
      // existing scraped row already richer-or-equal; skip
      continue;
    }
    await db.from("gym_equipment").delete().eq("gym_id", gym.id).eq("equipment_key", key);
    const { error } = await db.from("gym_equipment").insert(row);
    if (error) throw new Error(`${g.slug}/${key}: ${error.message}`);
    upserts++; if (prev) enriched++;
  }
  console.log(`  ✓ ${g.slug}: ${(g.found ?? []).length} facts processed`);
}
console.log(`Done. ${upserts} rows written (${enriched} replaced existing).`);
