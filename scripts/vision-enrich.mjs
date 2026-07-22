/**
 * R7 vision enrichment.
 *
 * Stage A — load tagged gallery photos (data/gym-galleries.json → gym_photos).
 * Stage B — Claude Haiku vision over each gym's gallery (≤6 images, URL
 *   sources): extract ONLY what is visibly evident — amenities (cafe,
 *   coworking, juice bar, turf, basketball), equipment incl. machine-level
 *   keys, visible rack counts / readable dumbbell maxes, vibe descriptors.
 * GAP-FILL ONLY: photo facts (conf 0.65, "Seen in facility photos") never
 *   override text-scraped rows; vibe tags union into gyms.vibe_tags.
 *
 * Anthropic key: Supabase Vault via service-role get_secret() RPC (same
 * pattern as the ai-search edge function).
 *
 * Usage: node scripts/vision-enrich.mjs [--dry-run] [--limit=N]
 */
import { createClient } from "@supabase/supabase-js";
import { paginateAll } from "./lib/paginate.mjs";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");
const LIMIT = Number((process.argv.find((a) => a.startsWith("--limit=")) ?? "").split("=")[1] || 0);

for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const VISION_AMENITIES = ["cafe", "coworking_space", "juice_bar", "turf_area", "basketball_court", "sauna", "cold_plunge", "pool"];
const VISION_EQUIPMENT = [
  "squat_rack", "power_rack", "platform", "dumbbells", "barbells", "kettlebells",
  "ghd", "sled", "ski_erg", "assault_bike", "rower", "reverse_hyper", "belt_squat",
  "cable_machine", "leg_press", "smith_machine", "hack_squat", "pull_up_bar",
  "dip_station", "climbing_wall", "hip_thrust", "leg_extension", "leg_curl",
  "abductor_adductor", "calf_machine",
];
const VISION_VIBES = ["trendy", "aesthetic", "social", "serene", "old_school", "no_frills", "hardcore"];

const PROMPT = `You are auditing a gym's own facility photos. Report ONLY what is clearly visible — never infer beyond the frame, never guess counts you cannot see. Output ONLY a JSON object:
{
  "amenities": string[],            // only from: ${VISION_AMENITIES.join(", ")} — only if unmistakably visible (an espresso counter = cafe; laptop tables/work nooks = coworking_space)
  "equipment": [{"key": string, "quantity": number|null, "max_weight_lbs": number|null}],
                                    // keys only from: ${VISION_EQUIPMENT.join(", ")}; quantity ONLY when you can count distinct units in frame; max_weight_lbs ONLY when a dumbbell label is readable
  "vibes": string[],                // only from: ${VISION_VIBES.join(", ")} — overall aesthetic judgment across the photos
  "parking_lot_visible": boolean    // a parking lot/garage clearly visible in an exterior shot
}`;

async function getAnthropicKey() {
  const { data, error } = await db.rpc("get_secret", { secret_name: "ANTHROPIC_API_KEY" });
  if (error || typeof data !== "string" || !data) throw new Error("Vault key unavailable");
  return data;
}

const galleries = JSON.parse(readFileSync(resolve(root, "data/gym-galleries.json"), "utf8"));
const { data: tampa } = await db.from("cities").select("id").eq("slug", "tampa").single();
const gyms = await paginateAll((from, to) =>
  db.from("gyms").select("id, slug, vibe_tags").eq("city_id", tampa.id).order("id", { ascending: true }).range(from, to),
);
const bySlug = new Map(gyms.map((g) => [g.slug, g]));

/* ── Stage A: photo rows ─────────────────────────────────────────── */
let photos = 0;
for (const g of galleries) {
  const gym = bySlug.get(g.slug);
  if (!gym || g.images.length === 0) continue;
  const rows = g.images.map((img) => ({
    gym_id: gym.id,
    url: img.url,
    subject: img.subject_guess ?? "other",
    source: "scraped",
  }));
  if (!DRY) {
    const { error } = await db.from("gym_photos").upsert(rows, { onConflict: "gym_id,url" });
    if (error) throw new Error(`${g.slug} photos: ${error.message}`);
  }
  photos += rows.length;
}
console.log(`Stage A: ${photos} photo rows`);

/* ── Stage B: vision over galleries ──────────────────────────────── */
const key = await getAnthropicKey();
const withImages = galleries.filter((g) => g.images.length > 0 && bySlug.has(g.slug));
const targets = LIMIT > 0 ? withImages.slice(0, LIMIT) : withImages;
const stats = { gyms: 0, amenities: 0, equipment: 0, vibes: 0, parking_confirms: 0 };

for (const g of targets) {
  const gym = bySlug.get(g.slug);
  const imgs = g.images.slice(0, 6);
  let parsed;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 700,
        temperature: 0,
        system: PROMPT,
        messages: [{
          role: "user",
          content: [
            ...imgs.map((img) => ({ type: "image", source: { type: "url", url: img.url } })),
            { type: "text", text: `Facility photos for a gym (subjects: ${imgs.map((i) => i.subject_guess).join(", ")}). Audit per the schema.` },
          ],
        }],
      }),
      signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
      console.log(`  ✗ ${g.slug}: API ${res.status} — skipped`);
      continue;
    }
    const data = await res.json();
    const text = data?.content?.[0]?.text ?? "";
    parsed = JSON.parse(text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1));
  } catch (err) {
    console.log(`  ✗ ${g.slug}: ${err.message} — skipped`);
    continue;
  }
  stats.gyms++;

  // amenities: gap-fill only (never touch existing rows)
  const seen = new Set(
    ((await db.from("gym_amenities").select("amenity_key").eq("gym_id", gym.id)).data ?? []).map((r) => r.amenity_key),
  );
  const aRows = (Array.isArray(parsed.amenities) ? parsed.amenities : [])
    .filter((k) => VISION_AMENITIES.includes(k) && !seen.has(k))
    .map((k) => ({
      gym_id: gym.id, amenity_key: k, present: true,
      source: "estimated", confidence: 0.65, detail: "Seen in facility photos",
    }));
  if (aRows.length > 0 && !DRY) {
    const { error } = await db.from("gym_amenities").insert(aRows);
    if (error) throw new Error(`${g.slug} amenities: ${error.message}`);
  }
  stats.amenities += aRows.length;

  // equipment: gap-fill only; counts only when model could count
  const eqSeen = new Set(
    ((await db.from("gym_equipment").select("equipment_key").eq("gym_id", gym.id)).data ?? []).map((r) => r.equipment_key),
  );
  const eRows = (Array.isArray(parsed.equipment) ? parsed.equipment : [])
    .filter((e) => e && VISION_EQUIPMENT.includes(e.key) && !eqSeen.has(e.key))
    .map((e) => ({
      gym_id: gym.id, equipment_key: e.key,
      quantity: Number.isInteger(e.quantity) && e.quantity > 0 && e.quantity < 60 ? e.quantity : null,
      max_weight_lbs: Number.isInteger(e.max_weight_lbs) && e.max_weight_lbs > 0 ? e.max_weight_lbs : null,
      brand: null, source: "estimated", confidence: 0.65, detail: "Seen in facility photos",
    }));
  if (eRows.length > 0 && !DRY) {
    const { error } = await db.from("gym_equipment").insert(eRows);
    if (error) throw new Error(`${g.slug} equipment: ${error.message}`);
  }
  stats.equipment += eRows.length;

  // vibes: union into vibe_tags
  const newVibes = (Array.isArray(parsed.vibes) ? parsed.vibes : []).filter(
    (v) => VISION_VIBES.includes(v) && !(gym.vibe_tags ?? []).includes(v),
  );
  if (newVibes.length > 0 && !DRY) {
    const { error } = await db
      .from("gyms")
      .update({ vibe_tags: [...(gym.vibe_tags ?? []), ...newVibes] })
      .eq("id", gym.id);
    if (error) throw new Error(`${g.slug} vibes: ${error.message}`);
  }
  stats.vibes += newVibes.length;

  // parking photo confirmation: bump estimated rows to 0.7
  if (parsed.parking_lot_visible === true && !DRY) {
    await db
      .from("gym_parking")
      .update({ confidence: 0.7, detail: "Strip-plaza location — customer parking expected · visible in facility photos" })
      .eq("gym_id", gym.id)
      .eq("source", "estimated");
    stats.parking_confirms++;
  }

  console.log(
    `  ✓ ${g.slug}: +${aRows.length} amen · +${eRows.length} equip · +${newVibes.length} vibes${parsed.parking_lot_visible ? " · parking seen" : ""}`,
  );
  await new Promise((r) => setTimeout(r, 400));
}

console.log(`\nDone${DRY ? " (dry)" : ""}. ${JSON.stringify(stats)}`);
