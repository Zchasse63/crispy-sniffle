/** P2-D women's loader: 3 new listings (Census-geocoded) + hygiene
 *  (4 flagged coords via Census-only, 9Round caution flag). */
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
  const lat = Number(geo.lat.toFixed(6));
  const lng = Number(geo.lng.toFixed(6));

  // Never delete-then-insert the gym row: a fresh insert mints a NEW uuid,
  // cascading data loss to gym_reviews/gym_visits/fact_confirmations/
  // followed_gyms and breaking any saved gym-id reference. Upsert by slug
  // instead — it keeps the existing id (if any) and updates fields in place.
  const { data: existingGym } = await db
    .from("gyms")
    .select("id, owner_listed")
    .eq("slug", meta.slug)
    .maybeSingle();

  let gymId;
  if (existingGym?.owner_listed) {
    // owner_listed guard — per-field source lands in WP-D. Leave the
    // owner-published row's catalog fields untouched; still use its id for
    // the amenity/equipment steps below.
    gymId = existingGym.id;
    console.log(`  · ${meta.slug}: owner-listed — gym row left untouched`);
  } else {
    const gymRow = {
      city_id: tampa.id, slug: meta.slug,
      name: c.name.replace(" – Carrollwood (Tampa)", " Carrollwood"),
      neighborhood: meta.neighborhood, address: c.address,
      lat, lng,
      segment: meta.segment, description: c.description,
      day_pass_price: c.day_pass_price, week_pass_price: c.week_pass_price,
      hours: c.hours ?? null, website: c.website, phone: c.phone,
      photo_url: c.photo_url, verified: false,
      drop_in_policy: meta.drop_in_policy, drop_in_note: meta.drop_in_note,
      monthly_from: meta.monthly_from, monthly_note: meta.monthly_note,
      vibe_tags: meta.vibe_tags,
    };
    const { data: ins, error } = await db
      .from("gyms")
      .upsert(gymRow, { onConflict: "slug" })
      .select("id")
      .single();
    if (error) throw new Error(`${meta.slug}: ${error.message}`);
    gymId = ins.id;
  }

  const VALID_AMEN = new Set(["sauna","cold_plunge","steam_room","pool","recovery_room","open_24h","classes","personal_training","turf_area","cardio_zone","basketball_court","day_pass","parking","lockers","showers","towel_service","wifi","juice_bar","childcare","cafe","coworking_space","womens_area","womens_only"]);
  const amenCandidates = (c.amenities ?? []).filter((a) => VALID_AMEN.has(a.key)).map((a) => ({
    gym_id: gymId, amenity_key: a.key, present: true, source: "scraped", confidence: 0.85,
    detail: a.detail ? String(a.detail).slice(0, 200) : null,
  }));
  if (c.hours?.open_24h && !amenCandidates.some((a) => a.amenity_key === "open_24h")) {
    amenCandidates.push({ gym_id: gymId, amenity_key: "open_24h", present: true, source: "scraped", confidence: 0.9, detail: null });
  }
  // Rank-guard + upsert (never a plain insert): the gym row can now already
  // exist from a prior run, so amenity_key rows can collide with the unique
  // constraint — insert() would throw. Skip any key an existing fact
  // outranks 'scraped'.
  let amen = amenCandidates;
  if (amenCandidates.length) {
    const { data: existingAmen } = await db
      .from("gym_amenities")
      .select("amenity_key, source")
      .eq("gym_id", gymId);
    const existingAmenBySource = new Map((existingAmen ?? []).map((a) => [a.amenity_key, a.source]));
    amen = amenCandidates.filter((a) => canOverwrite("scraped", existingAmenBySource.get(a.amenity_key)));
    if (amen.length) {
      const { error: ae } = await db.from("gym_amenities").upsert(amen, { onConflict: "gym_id,amenity_key" });
      if (ae) throw new Error(`${meta.slug} amen: ${ae.message}`);
    }
  }

  const VALID_EQ = new Set(["smith_machine","dumbbells","barbells","kettlebells","cable_machine","hip_thrust"]);
  const eqCandidates = (c.equipment ?? []).filter((e) => VALID_EQ.has(e.key)).map((e) => ({
    gym_id: gymId, equipment_key: e.key, brand: null, quantity: null, max_weight_lbs: null,
    source: "scraped", confidence: 0.8, detail: e.detail ? String(e.detail).slice(0, 180) : null,
  }));
  if (eqCandidates.length) {
    const { data: existingEq } = await db
      .from("gym_equipment")
      .select("equipment_key, source")
      .eq("gym_id", gymId);
    const existingEqBySource = new Map((existingEq ?? []).map((e) => [e.equipment_key, e.source]));
    const eq = eqCandidates.filter((e) => canOverwrite("scraped", existingEqBySource.get(e.equipment_key)));
    if (eq.length) {
      const { error: eqe } = await db.from("gym_equipment").upsert(eq, { onConflict: "gym_id,equipment_key" });
      if (eqe) throw new Error(`${meta.slug} equipment: ${eqe.message}`);
    }
  }
  console.log(`  ✓ ${meta.slug} @ (${lat}, ${lng}) · ${amen.length} amen`);
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
