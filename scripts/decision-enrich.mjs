/**
 * R6 decision-intelligence loader.
 *
 * Stage 1 — drop-in policy + membership pricing: hand-curated from the R3/R4
 *   scrape corpus (gym-published statements; every value traceable to a
 *   source already in data/*.json). Curation over regex on 32 rows: the
 *   strings are too idiosyncratic for patterns to beat eyes.
 * Stage 2 — bike racks / transit stops near each gym via OSM Overpass
 *   (edge distance, positives only — same rules as parking).
 *
 * Usage: node scripts/decision-enrich.mjs [--dry-run]
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DRY = process.argv.includes("--dry-run");

for (const line of readFileSync(resolve(root, ".env.local"), "utf8").split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

/** slug → { policy, note, monthly, monthlyNote } — all gym-published. */
const DECISIONS = {
  "powerhouse-gym-athletic-club": {
    policy: "walk_in",
    note: "$20 day pass at the desk — no appointment, no garage tickets",
    monthly: 32.99,
    monthlyNote: "Gold 2-year rate; $42.99/mo month-to-month",
  },
  "powerhouse-gym-north-tampa": {
    policy: "walk_in",
    note: "$15 day pass in club",
    monthly: 29.99,
    monthlyNote: "12-month contract rate; prepaid options available",
  },
  "813-barbell": {
    policy: "walk_in",
    note: "$20 day / $45 week passes via their online signup portal",
    monthly: 68,
    monthlyNote: "Recurring monthly; $65 student, $60 military/first responder",
  },
  "crossfit-jaguar": {
    policy: "restricted",
    note: "$20 drop-ins for experienced out-of-town CrossFitters only",
    monthly: null,
    monthlyNote: "Membership pricing by email request",
  },
  "seminole-heights-crossfit": {
    policy: "book_first",
    note: "$25 drop-in ($35 with tee) — book and pay online before you come",
    monthly: null,
    monthlyNote: "Membership pricing via request form",
  },
  "cigar-city-crossfit": {
    policy: "restricted",
    note: "Drop-ins welcome with 3+ months training experience; passes sold online",
    monthly: null,
    monthlyNote: "Membership pricing via request form",
  },
  "dale-mabry-crossfit": {
    policy: "book_first",
    note: "Classes book via WellnessLiving — confirm by phone, their site is offline",
    monthly: null,
    monthlyNote: null,
  },
  "westshore-crossfit": {
    policy: null,
    note: "Website currently offline — call for drop-in and rates",
    monthly: null,
    monthlyNote: null,
  },
  "crunch-fitness-carrollwood": {
    policy: "trial_route",
    note: "No day passes sold online — start with their free local guest pass",
    monthly: 15.99,
    monthlyNote: "Base month-to-month; $9.99/mo with 12-month commitment + $59.99 annual fee",
  },
  "crunch-fitness-south-tampa": {
    policy: "trial_route",
    note: "No day passes sold online — start with their free local guest pass",
    monthly: 15.99,
    monthlyNote: "Base month-to-month; $9.99/mo with 12-month commitment + $59.99 annual fee",
  },
  "eos-fitness-tampa-midtown": {
    policy: "trial_route",
    note: "Free 7-day guest pass for local visitors 18+ — no paid day pass needed",
    monthly: 9.99,
    monthlyNote: "Will Do tier + $59.99 annual fee; Will Power $29.99/mo adds guests",
  },
  "la-fitness-tampa-s-dale-mabry-signature": {
    policy: "trial_route",
    note: "Free 3-day trial guest pass",
    monthly: null,
    monthlyNote: "Membership prices not published for this Signature club",
  },
  "planet-fitness-tampa-fowler-ave": {
    policy: "membership_only",
    note: "No day passes — Classic membership is $10/mo, cancel online anytime",
    monthly: 10,
    monthlyNote: "Classic; PF Black Card $24.99/mo (guests + perks); $49 annual fee",
  },
  "anytime-fitness-carrollwood": {
    policy: "trial_route",
    note: "Free trial pass ('Try Us Free') + free fitness consultation",
    monthly: null,
    monthlyNote: "Pricing not published; includes 5,800+ club access worldwide",
  },
  "life-time-harbour-island": {
    policy: "membership_only",
    note: "Membership club — join via inquiry; no public day-pass route",
    monthly: null,
    monthlyNote: "Rates via join flow only",
  },
  "orangetheory-fitness-water-street-tampa": {
    policy: "trial_route",
    note: "First class free for first-timers — book ahead, classes fill",
    monthly: 79,
    monthlyNote: "Basic (4 classes/mo); Elite $119, Premier $179; class packs from $120/5",
  },
  "orangetheory-fitness-south-tampa": {
    policy: "trial_route",
    note: "First class free for first-timers — book ahead, classes fill",
    monthly: 79,
    monthlyNote: "Basic (4 classes/mo); Elite $119 ($69 first month), Premier $179",
  },
  "f45-training-sparkman-tampa": {
    policy: "trial_route",
    note: "Start with their trial via the F45 app; pricing at booking",
    monthly: null,
    monthlyNote: "May be HSA/FSA eligible",
  },
  "9round-fitness-tampa-henderson-blvd": {
    policy: "trial_route",
    note: "Free introductory session — schedule ahead; no fixed class times after",
    monthly: null,
    monthlyNote: "Pricing not published; confirm the club is operating before visiting",
  },
  "madabolic-ybor-city": {
    policy: "book_first",
    note: "$35 single drop-in (30-day expiry) — book your class ahead",
    monthly: 188,
    monthlyNote: "Unlimited, per 28 days ($188–$208); intro: 14 days for $14",
  },
  "camp-tampa": {
    policy: "book_first",
    note: "Single classes sold through their booking platform — price shows at checkout",
    monthly: null,
    monthlyNote: "Packs + unlimited membership via checkout; childcare from $9/camper",
  },
  "bayshore-fit": {
    policy: "walk_in",
    note: "$30 day pass — includes cold plunge and recovery room (sauna is members-only)",
    monthly: 149,
    monthlyNote: "Unlimited gym, classes, cold plunge, sauna and recovery",
  },
  "central-rock-gym-tampa": {
    policy: "walk_in",
    note: "$25 adult day pass at the desk; gear rental $5; first-timers get a quick intro",
    monthly: null,
    monthlyNote: "Month-to-month memberships, no start-up fees (rates in gym)",
  },
  "central-rock-gym-citrus-park": {
    policy: "walk_in",
    note: "$25 adult day pass at the desk; shoe rental $5; classes $15 for non-members",
    monthly: null,
    monthlyNote: "Month-to-month memberships, no start-up or cancellation fees",
  },
  "bella-prana-yoga-and-meditation": {
    policy: "walk_in",
    note: "$25 drop-in — walk-ins welcome, reservations recommended; mat rental $3",
    monthly: 125,
    monthlyNote: "Unlimited $125–$160/mo; intro: first month unlimited $39",
  },
  "kodawari-studios": {
    policy: "book_first",
    note: "$22 intro sauna/cold-plunge session or $69 first-month yoga — sessions book ahead",
    monthly: 72,
    monthlyNote: "Memberships $72–$320/mo by tier",
  },
  "club-pilates-south-tampa": {
    policy: "trial_route",
    note: "Free intro class is the way in — book it online",
    monthly: null,
    monthlyNote: "Membership pricing in studio; enrollment promos common",
  },
  "solidcore-hyde-park": {
    policy: "book_first",
    note: "Classes book through their app — first-timer rates at checkout",
    monthly: null,
    monthlyNote: "Packages via booking portal",
  },
  "tampa-muay-thai": {
    policy: "walk_in",
    note: "$25 single class (free intro for first-timers) — gloves and wraps provided",
    monthly: 179,
    monthlyNote: "Unlimited Muay Thai; $249 all-access adds BJJ",
  },
  "gracie-tampa-south-mma": {
    policy: "trial_route",
    note: "Web-special trial offer — request schedule and pricing",
    monthly: null,
    monthlyNote: null,
  },
  "perspire-sauna-studio-south-tampa": {
    policy: "book_first",
    note: "$60 single session ($30 intro for new guests) — suites are private, book ahead",
    monthly: 99,
    monthlyNote: "4 sessions/mo; 8 for $159; unlimited $199",
  },
  "restore-hyper-wellness-carrollwood": {
    policy: "walk_in",
    note: "Pay-per-service: core therapies $42 retail ($27 member) — walk in or book",
    monthly: 170,
    monthlyNote: "Credit-based memberships $170–$300/mo",
  },
};

const OVERPASS = "https://overpass-api.de/api/interpreter";
const TAMPA_BBOX = "27.65,-82.95,28.25,-82.25";
const MAX_M = { bike_rack: 100, bus_stop: 250, rail_station: 600 };

const hav = (a, b, c, d) => {
  const r = Math.PI / 180;
  [a, b, c, d] = [a * r, b * r, c * r, d * r];
  return 2 * 6371000 * Math.asin(Math.sqrt(
    Math.sin((c - a) / 2) ** 2 + Math.cos(a) * Math.cos(c) * Math.sin((d - b) / 2) ** 2,
  ));
};

const { data: tampa } = await db.from("cities").select("id").eq("slug", "tampa").single();
const { data: gyms, error: ge } = await db
  .from("gyms")
  .select("id, slug, lat, lng")
  .eq("city_id", tampa.id);
if (ge) throw ge;

/* ── Stage 1: drop-in policy + membership pricing ────────────────── */
let updated = 0;
for (const gym of gyms) {
  const d = DECISIONS[gym.slug];
  if (!d) continue;
  if (!DRY) {
    const { error } = await db
      .from("gyms")
      .update({
        drop_in_policy: d.policy,
        drop_in_note: d.note,
        monthly_from: d.monthly,
        monthly_note: d.monthlyNote,
      })
      .eq("id", gym.id);
    if (error) throw new Error(`${gym.slug}: ${error.message}`);
  }
  updated++;
}
console.log(`Stage 1: ${updated} gyms — drop-in policy + membership pricing`);

/* ── Stage 2: bike racks + transit via Overpass ──────────────────── */
let transitRows = 0;
try {
  // per-gym radius clauses, batched — one metro bbox hit the element cap;
  // one 96-clause union got rejected. 8 gyms per request, polite spacing.
  const located = gyms.filter((g) => g.lat !== null && g.lng !== null);
  const allElements = [];
  for (let i = 0; i < located.length; i += 8) {
    const batch = located.slice(i, i + 8);
    const clauses = batch
      .map(
        (g) =>
          `nwr["amenity"="bicycle_parking"](around:100,${g.lat},${g.lng});` +
          `node["highway"="bus_stop"](around:250,${g.lat},${g.lng});` +
          `node["railway"~"station|tram_stop"](around:600,${g.lat},${g.lng});`,
      )
      .join("");
    const q = `[out:json][timeout:60];(${clauses});out tags geom 800;`;
    const res = await fetch(OVERPASS, {
      method: "POST",
      body: "data=" + encodeURIComponent(q),
      headers: { "User-Agent": "ScoutGymBeta/0.1 (zchasse89@gmail.com)" },
      signal: AbortSignal.timeout(75000),
    });
    const text = await res.text();
    if (!res.ok || text.startsWith("<")) {
      console.log(`  batch ${i / 8 + 1}: Overpass declined (${res.status}) — skipping`);
    } else {
      allElements.push(...(JSON.parse(text).elements ?? []));
    }
    await new Promise((r) => setTimeout(r, 2500));
  }
  const data = { elements: allElements };
  const els = (data.elements ?? [])
    .map((el) => {
      let pts = [];
      if (el.type === "node") pts = [[el.lat, el.lon]];
      else if (el.geometry) pts = el.geometry.map((p) => [p.lat, p.lon]);
      if (pts.length === 0) return null;
      const t = el.tags ?? {};
      const kind =
        t.amenity === "bicycle_parking" ? "bike_rack"
        : t.highway === "bus_stop" ? "bus_stop"
        : "rail_station";
      return { kind, name: t.name ?? null, route: t.route_ref ?? null, pts };
    })
    .filter(Boolean);
  console.log(`Overpass: ${els.length} mobility features in Tampa bbox`);

  for (const gym of gyms) {
    if (gym.lat === null || gym.lng === null) continue;
    const best = new Map(); // kind -> nearest hit
    for (const e of els) {
      let d = Infinity;
      for (const [plat, plng] of e.pts) {
        const dd = hav(Number(gym.lat), Number(gym.lng), plat, plng);
        if (dd < d) d = dd;
      }
      if (d > MAX_M[e.kind]) continue;
      const cur = best.get(e.kind);
      if (!cur || d < cur.d) best.set(e.kind, { ...e, d: Math.round(d) });
    }
    // delete FIRST, even with zero hits — stale rows must not survive a
    // gym whose mapped stop/rack disappeared from OSM
    if (!DRY) {
      const { error: de } = await db.from("gym_transit").delete().eq("gym_id", gym.id);
      if (de) throw new Error(`${gym.slug} transit delete: ${de.message}`);
    }
    if (best.size === 0) continue;
    const rows = [...best.values()].map((h) => ({
      gym_id: gym.id,
      kind: h.kind,
      name: h.name,
      distance_m: h.d,
      lat: h.pts[0][0],
      lng: h.pts[0][1],
      source: "osm",
      confidence: 0.65,
      detail: h.route ? `Routes: ${h.route}` : null,
    }));
    if (!DRY) {
      const { error: ie } = await db.from("gym_transit").insert(rows);
      if (ie) throw new Error(`${gym.slug} transit insert: ${ie.message}`);
    }
    transitRows += rows.length;
  }
} catch (err) {
  console.log(`⚠ Overpass mobility failed (${err.message}) — Stage 1 results stand`);
}
console.log(`Stage 2: ${transitRows} transit/bike rows`);
console.log(`Done${DRY ? " (dry run)" : ""}.`);
