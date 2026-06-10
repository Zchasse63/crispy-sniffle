/** P2-D women's loader: 3 new listings (Census-geocoded) + hygiene
 *  (4 flagged coords via Census-only, 9Round caution flag). */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function census(address) {
  const url = "https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?" +
    new URLSearchParams({ address, benchmark: "Public_AR_Current", format: "json" });
  const res = await fetch(url, { signal: AbortSignal.timeout(30000) });
  const m = (await res.json())?.result?.addressMatches?.[0];
  return m ? { lat: m.coordinates.y, lng: m.coordinates.x } : null;
}

const { data: tampa } = await db.from("cities").select("id").eq("slug", "tampa").single();
const data = JSON.parse(readFileSync(resolve(root, "data/womens-research.json"), "utf8"));

const META = {
  "Amped Fitness – Carrollwood (Tampa)": {
    slug: "amped-fitness-carrollwood", segment: "big_box", neighborhood: "Carrollwood",
    drop_in_policy: "trial_route", drop_in_note: "Free 3-day guest pass via ampedfitness.com/free-pass",
    monthly_from: 14.99, monthly_note: "Memberships from $14.99/mo",
    vibe_tags: ["social", "trendy", "beginner_friendly"],
  },
  "Peach Lab": {
    slug: "peach-lab-tampa", segment: "boutique", neighborhood: "South Tampa",
    drop_in_policy: "book_first", drop_in_note: "Intro: 3 classes for $30 (single classes $30) — book online",
    monthly_from: null, monthly_note: "Class packs + unlimited memberships via booking portal",
    vibe_tags: ["trendy", "aesthetic", "community", "hardcore"],
  },
  "Fox Fitness": {
    slug: "fox-fitness-south-tampa", segment: "boutique", neighborhood: "South Tampa",
    drop_in_policy: "trial_route", drop_in_note: "14-day free trial pass; '4 Weeks for $49' intro",
    monthly_from: null, monthly_note: "Small-group + private training pricing in studio",
    vibe_tags: ["community", "beginner_friendly", "serene"],
  },
};

for (const c of data.candidates) {
  const meta = META[c.name];
  if (!meta) { console.log(`  ✗ no meta for ${c.name}`); continue; }
  const geo = (await census(c.address)) ?? { lat: c.lat, lng: c.lng };
  const gymRow = {
    city_id: tampa.id, slug: meta.slug,
    name: c.name.replace(" – Carrollwood (Tampa)", " Carrollwood"),
    neighborhood: meta.neighborhood, address: c.address,
    lat: Number(geo.lat.toFixed(6)), lng: Number(geo.lng.toFixed(6)),
    segment: meta.segment, description: c.description,
    day_pass_price: c.day_pass_price, week_pass_price: c.week_pass_price,
    hours: c.hours ?? null, website: c.website, phone: c.phone,
    photo_url: c.photo_url, verified: false,
    drop_in_policy: meta.drop_in_policy, drop_in_note: meta.drop_in_note,
    monthly_from: meta.monthly_from, monthly_note: meta.monthly_note,
    vibe_tags: meta.vibe_tags,
  };
  await db.from("gyms").delete().eq("slug", meta.slug); // re-runnable
  const { data: ins, error } = await db.from("gyms").insert(gymRow).select("id").single();
  if (error) throw new Error(`${meta.slug}: ${error.message}`);
  const VALID_AMEN = new Set(["sauna","cold_plunge","steam_room","pool","recovery_room","open_24h","classes","personal_training","turf_area","cardio_zone","basketball_court","day_pass","parking","lockers","showers","towel_service","wifi","juice_bar","childcare","cafe","coworking_space","womens_area","womens_only"]);
  const amen = (c.amenities ?? []).filter((a) => VALID_AMEN.has(a.key)).map((a) => ({
    gym_id: ins.id, amenity_key: a.key, present: true, source: "scraped", confidence: 0.85,
    detail: a.detail ? String(a.detail).slice(0, 200) : null,
  }));
  if (c.hours?.open_24h && !amen.some((a) => a.amenity_key === "open_24h")) {
    amen.push({ gym_id: ins.id, amenity_key: "open_24h", present: true, source: "scraped", confidence: 0.9, detail: null });
  }
  if (amen.length) {
    const { error: ae } = await db.from("gym_amenities").insert(amen);
    if (ae) throw new Error(`${meta.slug} amen: ${ae.message}`);
  }
  const VALID_EQ = new Set(["smith_machine","dumbbells","barbells","kettlebells","cable_machine","hip_thrust"]);
  const eq = (c.equipment ?? []).filter((e) => VALID_EQ.has(e.key)).map((e) => ({
    gym_id: ins.id, equipment_key: e.key, brand: null, quantity: null, max_weight_lbs: null,
    source: "scraped", confidence: 0.8, detail: e.detail ? String(e.detail).slice(0, 180) : null,
  }));
  if (eq.length) await db.from("gym_equipment").insert(eq);
  console.log(`  ✓ ${meta.slug} @ (${gymRow.lat}, ${gymRow.lng}) · ${amen.length} amen`);
  await new Promise((r) => setTimeout(r, 500));
}

// hygiene: 4 flagged coords via Census-only (consensus failed; Census matched exact street numbers)
const FLAGGED = [
  ["anytime-fitness-carrollwood"], ["crossfit-jaguar"], ["crunch-fitness-carrollwood"], ["restore-hyper-wellness-carrollwood"],
];
for (const [slug] of FLAGGED) {
  const { data: g } = await db.from("gyms").select("id, address, lat, lng").eq("slug", slug).maybeSingle();
  if (!g?.address) continue;
  const geo = await census(g.address.replace(/\s*Suite.*$|\s*Ste\.?\s.*$|\s*#.*$/i, ""));
  if (!geo) { console.log(`  ⚠ ${slug}: census no-match — left as-is`); continue; }
  // plausibility: within 12km of current city-correct seed
  const d = Math.hypot((geo.lat - g.lat) * 111000, (geo.lng - g.lng) * 96000);
  if (d > 12000) { console.log(`  ⚠ ${slug}: implausible ${Math.round(d / 1000)}km — left as-is`); continue; }
  await db.from("gyms").update({ lat: Number(geo.lat.toFixed(6)), lng: Number(geo.lng.toFixed(6)) }).eq("id", g.id);
  console.log(`  ✓ ${slug}: coords → census (moved ${Math.round(d)}m)`);
  await new Promise((r) => setTimeout(r, 400));
}

// 9Round: keep listed, ensure unverified + caution remains in description
await db.from("gyms").update({ verified: false }).eq("slug", "9round-fitness-tampa-henderson-blvd");
console.log("  ✓ 9round flagged unverified");
console.log("Done.");
