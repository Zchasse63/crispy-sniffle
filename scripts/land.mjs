// Metro-expansion Stage 4+6 — EXTRACT + VISION + LAND. For each 'fetched' candidate:
// read cached pages -> Haiku TEXT extract (amenities/hours/prices/description) ->
// Haiku VISION over photos (equipment) -> create the gym with honest provenance
// (text-stated = scraped 0.85; vision-derived = estimated 0.65; unknown = omitted).
//
//   node scripts/land.mjs --metro=miami --limit=40        # DRY: extract + report, no writes
//   node scripts/land.mjs --metro=miami --limit=40 --land # actually create gyms
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
} catch { /* env */ }
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const metro = (process.argv.find((a) => a.startsWith("--metro=")) || "--metro=miami").split("=")[1];
const limit = Number((process.argv.find((a) => a.startsWith("--limit=")) || "--limit=40").split("=")[1]);
const LAND = process.argv.includes("--land");
const CACHE = "facility-cache";
const CITY_BY_METRO = { miami: "Miami", tampa: "Tampa" };

const AMENITY_VOCAB = ["basketball_court","cafe","cardio_zone","childcare","classes","cold_plunge","day_pass","juice_bar","lockers","open_24h","parking","personal_training","pool","recovery_room","sauna","showers","steam_room","towel_service","turf_area","wifi","womens_area","womens_only"];
const EQUIPMENT_VOCAB = ["squat_rack","power_rack","platform","dumbbells","barbells","kettlebells","ghd","sled","ski_erg","assault_bike","rower","reverse_hyper","belt_squat","comp_bench","cable_machine","leg_press","smith_machine","hack_squat","pull_up_bar","monolift","climbing_wall","leg_extension","leg_curl","abductor_adductor","stepmill","specialty_bars"];
const VALID_SEGMENTS = new Set(["strength","crossfit","big_box","boutique","climbing","yoga_pilates","mma","recovery","luxury","cycling","barre"]);

async function anthropic(key, body) {
  // Never let one slow/failed API call crash the whole run: a timeout, network
  // error, or 429/5xx returns null (that gym is skipped), with one backoff retry.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5", temperature: 0, ...body }),
        signal: AbortSignal.timeout(60000),
      });
      if (res.status === 429 || res.status >= 500) { await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); continue; }
      if (!res.ok) return null;
      const j = await res.json();
      const text = j.content?.[0]?.text ?? "";
      const m = text.match(/\{[\s\S]*\}/);
      if (!m) return null;
      try { return JSON.parse(m[0]); } catch { return null; }
    } catch {
      await new Promise((r) => setTimeout(r, 1500 * (attempt + 1))); // timeout / network — back off and retry once
    }
  }
  return null;
}

async function extractText(name, content, key) {
  const system =
    `Extract gym facts from website text into STRICT JSON. Never guess — omit anything not clearly stated.\n` +
    `amenities: array, ONLY keys the site clearly offers: ${AMENITY_VOCAB.join(", ")}.\n` +
    `equipment: array, ONLY keys clearly named in text: ${EQUIPMENT_VOCAB.join(", ")}.\n` +
    `day_pass_price: number USD or null. monthly_from: cheapest monthly membership USD or null. ` +
    `hours: {mon..sun:["HH:MM","HH:MM"]} or null. ` +
    `phone: string or null. description: 1-2 factual sentences or null.\n` +
    `segment: the ONE best-fit facility type, or null if genuinely unclear. Choose from: ` +
    `strength (powerlifting / barbell / hardcore lifting), crossfit (CrossFit / functional-fitness box), ` +
    `big_box (large multi-purpose commercial gym: cardio + machines + free weights), ` +
    `boutique (group-class studio: HIIT, infrared, bootcamp), yoga_pilates (yoga or pilates studio), ` +
    `mma (martial arts, boxing, kickboxing, BJJ), recovery (stretch / cryo / sauna / recovery-focused), ` +
    `luxury (high-end full-service club), cycling (indoor cycling / spin studio), barre (barre studio), ` +
    `climbing (climbing / bouldering gym). Output ONLY JSON.`;
  return anthropic(key, { max_tokens: 1500, system, messages: [{ role: "user", content: `Gym: ${name}\n\n${content}` }] });
}
async function extractVision(name, urls, key) {
  if (!urls.length) return { equipment: [], amenities: [] };
  const system =
    `Audit GYM FACILITY PHOTOS. List ONLY clearly-visible items — never guess.\n` +
    `equipment keys: ${EQUIPMENT_VOCAB.join(", ")}. amenities keys: ${AMENITY_VOCAB.join(", ")}.\n` +
    `Output ONLY JSON: {"equipment":[...],"amenities":[...]}.`;
  const out = await anthropic(key, {
    max_tokens: 600, system,
    messages: [{ role: "user", content: [
      ...urls.slice(0, 5).map((url) => ({ type: "image", source: { type: "url", url } })),
      { type: "text", text: `${Math.min(urls.length, 5)} facility photos for "${name}". What equipment/amenities are visible?` },
    ] }],
  });
  return out || { equipment: [], amenities: [] };
}

const slugify = (s) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
const num = (v) => (v == null || Number.isNaN(Number(v)) ? null : Number(v));
const cleanHours = (h) => {
  if (!h || typeof h !== "object") return null;
  const days = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  const out = {};
  for (const d of days) {
    const t = h[d];
    if (Array.isArray(t) && t.length === 2 && /^\d{1,2}:\d{2}$/.test(t[0]) && /^\d{1,2}:\d{2}$/.test(t[1])) out[d] = [t[0], t[1]];
  }
  return Object.keys(out).length ? out : null;
};

// ── setup ──
const cityName = CITY_BY_METRO[metro];
const { data: city } = await db.from("cities").select("id").eq("name", cityName).maybeSingle();
if (!city) { console.error(`City '${cityName}' not found`); process.exit(1); }
const anthropicKey = (await db.rpc("get_secret", { secret_name: "ANTHROPIC_API_KEY" })).data;
if (!anthropicKey) { console.error("No Anthropic key from Vault"); process.exit(1); }

const { data: allGyms } = await db.from("gyms").select("slug, name, city_id, lat, lng");
const usedSlugs = new Set(allGyms.map((g) => g.slug));
const usedNames = new Set(allGyms.map((g) => g.name.toLowerCase().trim())); // grows; drives chain disambiguation
// Dedup vs existing gyms WITHOUT collapsing chains: a shared name is only a dup when
// it's also the SAME PLACE. Same building (<80m, any name) OR same-ish name within
// 500m (absorbs geocoding drift + suffixed curated names like "Crunch - South Tampa")
// = dup. Distinct branches of a chain (miles apart, identical name) are NOT dups —
// they land with locality disambiguation via dispName().
const cityGyms = allGyms
  .filter((g) => g.city_id === city.id)
  .map((g) => ({ name: g.name, lat: Number(g.lat), lng: Number(g.lng) }));
const haversine = (la1, lo1, la2, lo2) => {
  const R = 6371000, r = Math.PI / 180;
  const dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
  const x = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
};
const norm = (s) => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
const nameSim = (a, b) => {
  a = norm(a); b = norm(b);
  if (!a || !b) return false;
  if (a === b || a.startsWith(b + " ") || b.startsWith(a + " ")) return true; // one contains the other
  const ta = new Set(a.split(" ").filter((w) => w.length > 2));
  return b.split(" ").filter((w) => w.length > 2 && ta.has(w)).length >= 2;   // >=2 shared significant tokens
};
const isExisting = (c) => {
  const la = Number(c.lat), lo = Number(c.lng), hasC = Number.isFinite(la) && Number.isFinite(lo);
  return cityGyms.some((g) => {
    if (hasC && Number.isFinite(g.lat) && Number.isFinite(g.lng)) {
      const d = haversine(la, lo, g.lat, g.lng);
      return d < 80 || (d < 500 && nameSim(c.name, g.name));
    }
    return norm(c.name) === norm(g.name); // coords missing on either side → exact-name fallback
  });
};
const uniqueSlug = (name) => {
  let base = slugify(name) || "gym";
  let s = base, i = 2;
  while (usedSlugs.has(s)) s = `${base}-${i++}`;
  usedSlugs.add(s);
  return s;
};
// Chains repeat the same Overture name (5 "Orangetheory Fitness") — disambiguate by locality.
const dispName = (name, locality) => {
  let n = usedNames.has(name.toLowerCase().trim()) && locality ? `${name} - ${locality}` : name;
  const base = n;
  let i = 2;
  while (usedNames.has(n.toLowerCase().trim())) n = `${base} (${i++})`;
  usedNames.add(n.toLowerCase().trim());
  return n;
};

const { data: cands } = await db
  .from("facility_candidates")
  .select("overture_id, name, segment, address, locality, lat, lng, website, socials, phone, photos, confidence")
  .eq("metro", metro).eq("status", "fetched")
  .order("confidence", { ascending: false }).limit(limit);

console.log(`${LAND ? "LANDING" : "DRY"} — ${cands.length} ${metro} candidates -> ${cityName}\n`);
const stats = { landed: 0, skipped: 0, amenities: 0, equipment: 0, withHours: 0, withPrice: 0 };

for (const c of cands) {
  if (isExisting(c)) { stats.skipped++; console.log(`  DUP  ${c.name} (existing gym)`); continue; }
  const { data: files } = await db.storage.from(CACHE).list(c.overture_id, { limit: 8 });
  const pages = [];
  for (const f of files ?? []) {
    const { data: blob } = await db.storage.from(CACHE).download(`${c.overture_id}/${f.name}`);
    if (blob) pages.push(`# ${f.name}\n${(await blob.text()).slice(0, 6000)}`);
  }
  if (!pages.length) { stats.skipped++; console.log(`  SKIP ${c.name} (no cache)`); continue; }

  const [text, vision] = await Promise.all([
    extractText(c.name, pages.join("\n\n").slice(0, 18000), anthropicKey),
    extractVision(c.name, Array.isArray(c.photos) ? c.photos : [], anthropicKey),
  ]);
  if (!text) { stats.skipped++; console.log(`  SKIP ${c.name} (extract failed)`); continue; }

  const textAm = new Set((text.amenities || []).filter((k) => AMENITY_VOCAB.includes(k)));
  const visAm = new Set((vision.amenities || []).filter((k) => AMENITY_VOCAB.includes(k) && !textAm.has(k)));
  const textEq = new Set((text.equipment || []).filter((k) => EQUIPMENT_VOCAB.includes(k)));
  const visEq = new Set((vision.equipment || []).filter((k) => EQUIPMENT_VOCAB.includes(k) && !textEq.has(k)));
  const hours = cleanHours(text.hours);
  const dp0 = num(text.day_pass_price);
  const dayPass = dp0 != null && dp0 >= 3 && dp0 <= 200 ? dp0 : null; // implausible price -> unlisted (never fabricate)
  const mo0 = num(text.monthly_from);
  const monthlyFrom = mo0 != null && mo0 >= 5 && mo0 <= 1000 ? mo0 : null;
  const amCount = textAm.size + visAm.size, eqCount = textEq.size + visEq.size;
  // Segment precedence: rule-based (Overture-category-derived, precise) wins; else Haiku's
  // read of the actual site; else null. Segment is SOFT (KODAWARI) so best-effort is safe.
  const seg = VALID_SEGMENTS.has(c.segment) ? c.segment : (VALID_SEGMENTS.has(text.segment) ? text.segment : null);

  console.log(`  ${LAND ? "LAND" : "DRY "} ${c.name.slice(0, 34).padEnd(34)} seg=${seg ?? "?"} am=${amCount}(${textAm.size}s/${visAm.size}v) eq=${eqCount}(${textEq.size}s/${visEq.size}v) hrs=${hours ? "Y" : "-"} $${dayPass ?? "-"}`);
  stats.amenities += amCount; stats.equipment += eqCount; if (hours) stats.withHours++; if (dayPass != null) stats.withPrice++;

  // Quality gate: don't create an empty listing. A JS-walled site that yielded
  // nothing is rejected for the escalation stage, not landed as a blank gym.
  const hasSignal = amCount > 0 || eqCount > 0 || !!hours || (text.description && text.description.length > 40);
  if (!hasSignal) {
    stats.skipped++;
    if (LAND) await db.from("facility_candidates").update({ status: "rejected", reject_reason: "thin-extraction", updated_at: new Date().toISOString() }).eq("overture_id", c.overture_id);
    console.log(`     ~ thin (no facts) — held for escalation`);
    continue;
  }
  if (!LAND) { stats.landed++; continue; }

  const name = dispName(c.name, c.locality);
  const slug = uniqueSlug(name);
  const instagram = c.socials?.instagram ?? null;
  const { data: gym, error: gErr } = await db.from("gyms").insert({
    city_id: city.id, name, slug, segment: seg,
    lat: num(c.lat), lng: num(c.lng), address: c.address, neighborhood: c.locality,
    phone: text.phone || c.phone, website: c.website, instagram,
    description: text.description || null, hours, day_pass_price: dayPass, monthly_from: monthlyFrom,
    photo_url: Array.isArray(c.photos) && c.photos.length ? c.photos[0] : null,
    status: "active",
  }).select("id").single();
  if (gErr) { stats.skipped++; console.log(`     ! insert failed: ${gErr.message}`); continue; }

  const amRows = [
    ...[...textAm].map((k) => ({ gym_id: gym.id, amenity_key: k, present: true, source: "scraped", confidence: 0.85, detail: null })),
    ...[...visAm].map((k) => ({ gym_id: gym.id, amenity_key: k, present: true, source: "estimated", confidence: 0.65, detail: "Seen in facility photos" })),
  ];
  const eqRows = [
    ...[...textEq].map((k) => ({ gym_id: gym.id, equipment_key: k, source: "scraped", confidence: 0.85, detail: null })),
    ...[...visEq].map((k) => ({ gym_id: gym.id, equipment_key: k, source: "estimated", confidence: 0.65, detail: "Seen in facility photos" })),
  ];
  if (amRows.length) await db.from("gym_amenities").upsert(amRows, { onConflict: "gym_id,amenity_key" });
  if (eqRows.length) await db.from("gym_equipment").upsert(eqRows, { onConflict: "gym_id,equipment_key" });
  // Gallery: land the collected facility photos (rehost-photos later moves them to our Storage).
  const photoRows = (Array.isArray(c.photos) ? c.photos : []).slice(0, 8).map((url) => ({ gym_id: gym.id, url, source: "scraped" }));
  if (photoRows.length) await db.from("gym_photos").upsert(photoRows, { onConflict: "gym_id,url" });
  await db.from("facility_candidates").update({ status: "landed", gym_id: gym.id, landed_at: new Date().toISOString() }).eq("overture_id", c.overture_id);
  // Feed the just-landed gym back into the in-run dedup set so a second Overture
  // entry for the same place (same coords, different name) doesn't double-land.
  cityGyms.push({ name, lat: num(c.lat), lng: num(c.lng) });
  stats.landed++;
}

console.log(`\n${LAND ? "LANDED" : "DRY total"}: ${stats.landed} gyms, ${stats.skipped} skipped. ` +
  `Facts: ${stats.amenities} amenities, ${stats.equipment} equipment, ${stats.withHours} w/hours, ${stats.withPrice} w/day-pass.`);
