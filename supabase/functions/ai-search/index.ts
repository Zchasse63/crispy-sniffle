// Scout ai-search — natural language → FilterSet (strict JSON contract).
// The LLM ONLY parses language into filters. Scoring stays deterministic
// client-side. No key configured → 503 → client falls back to its local
// parser, so the app never hard-depends on this function.
//
// Deployed with verify_jwt=false because new-format publishable keys are
// not JWTs; auth here = apikey header required + rate limit + input caps.
//
// Anthropic key resolution: ANTHROPIC_API_KEY env secret wins if set;
// otherwise falls back to Supabase Vault via the service-role-only
// public.get_secret() RPC (see vault_secret_accessor migration).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

// Presence→value check on the publishable apikey header. SUPABASE_ANON_KEY is
// injected automatically on Supabase edge; SB_PUBLISHABLE_KEY is an optional
// alias. If neither env is set, fall back to presence-only (fail-safe — don't
// brick the endpoint on a misconfigured isolate) and warn once.
let _apikeyEnvWarned = false;
function apikeyAuthorized(req: Request): boolean {
  const header = req.headers.get("apikey");
  if (!header) return false;
  // The app sends the PUBLISHABLE key (sb_publishable_...), while the edge
  // runtime auto-injects the legacy anon JWT as SUPABASE_ANON_KEY — they are
  // DIFFERENT values. Accept a match against ANY configured valid key, else a
  // publishable-key client would be 401'd by the anon-key comparison.
  const expected = [
    Deno.env.get("SUPABASE_ANON_KEY"),
    Deno.env.get("SB_PUBLISHABLE_KEY"),
  ].filter((v): v is string => !!v);
  if (expected.length === 0) {
    if (!_apikeyEnvWarned) {
      console.warn(
        "apikey gate: neither SUPABASE_ANON_KEY nor SB_PUBLISHABLE_KEY set; falling back to presence-only check",
      );
      _apikeyEnvWarned = true;
    }
    return true;
  }
  return expected.includes(header);
}

// NOTE: open_24h is deliberately NOT in this list — 24-hour intent flows
// exclusively through the open24h boolean (single source of truth).
const AMENITIES = [
  "sauna", "cold_plunge", "steam_room", "pool", "recovery_room",
  "classes", "personal_training", "turf_area", "cardio_zone", "basketball_court",
  "day_pass", "parking", "lockers", "showers", "towel_service", "wifi",
  "juice_bar", "childcare", "cafe", "coworking_space", "womens_area", "womens_only",
  "tanning", "hydromassage", "spin_studio", "retail_shop", "props_provided",
  "open_gym", "chalk_allowed", "wheelchair_accessible", "accessible_restrooms",
];
const EQUIPMENT = [
  "squat_rack", "power_rack", "platform", "dumbbells", "barbells", "kettlebells",
  "ghd", "sled", "ski_erg", "assault_bike", "rower", "reverse_hyper", "belt_squat",
  "comp_bench", "cable_machine", "leg_press", "smith_machine", "hack_squat",
  "pull_up_bar", "dip_station", "monolift", "climbing_wall",
  "hip_thrust", "leg_extension", "leg_curl", "abductor_adductor", "calf_machine",
  "stepmill", "specialty_bars", "nordic_bench",
  "treadmill", "elliptical", "upright_bike", "recumbent_bike", "stair_climber",
  "reformer", "pilates_tower", "cadillac", "pilates_chair", "pilates_barrel", "aerial_rig",
  "heavy_bag", "boxing_ring", "mma_cage", "mats", "spin_bike",
  "curved_treadmill", "versaclimber", "jacobs_ladder", "arc_trainer", "incline_trainer", "water_rower",
  "recumbent_stepper", "upper_body_ergometer", "chest_press_machine", "shoulder_press_machine", "lat_pulldown_machine", "seated_row_machine",
  "pec_deck", "rear_delt_machine", "lateral_raise_machine", "preacher_curl_machine", "tricep_extension_machine", "tricep_pushdown_machine",
  "assisted_pull_up_dip_machine", "ab_crunch_machine", "back_extension_machine", "torso_rotation_machine", "glute_machine", "lat_pullover_machine",
  "cable_crossover", "iso_lateral_chest_press", "iso_lateral_incline_press", "iso_lateral_shoulder_press", "iso_lateral_row", "iso_lateral_pulldown",
  "t_bar_row_machine", "pendulum_squat", "v_squat", "linear_leg_press", "seated_dip_machine", "landmine_station",
  "adjustable_bench", "flat_bench", "incline_bench", "decline_bench", "preacher_bench", "adjustable_dumbbells",
  "bumper_plates", "weight_plates", "change_plates", "trap_bar", "ez_curl_bar", "safety_squat_bar",
  "swiss_bar", "fat_grip_bar", "half_rack", "wall_mounted_rack", "deadlift_jack", "resistance_bands",
  "jerk_blocks", "battle_ropes", "plyo_boxes", "medicine_balls", "slam_balls", "wall_balls",
  "suspension_trainer", "gymnastic_rings", "parallettes", "climbing_rope", "jump_ropes", "agility_ladder",
  "ab_wheel", "weighted_vest", "sandbags", "tires", "atlas_stones", "yoke",
  "farmers_handles", "log_bar", "balance_trainer", "stability_ball", "vibration_plate", "ballet_barre",
  "spring_wall", "magic_circle", "spine_corrector", "jump_board", "yoga_blocks", "yoga_straps",
  "yoga_bolsters", "yoga_wheel", "yoga_swing", "pilates_mat", "toning_balls", "balance_pad",
  "balance_board", "ankle_weights", "foam_roller", "speed_bag", "double_end_bag", "muay_thai_bag",
  "uppercut_bag", "free_standing_bag", "body_opponent_bag", "reflex_bag", "aqua_bag", "grappling_dummy",
  "wing_chun_dummy", "focus_mitts_area", "normatec_boots", "massage_gun", "stretching_station", "inversion_table",
];
const SEGMENTS = [
  "strength", "crossfit", "big_box", "boutique", "climbing", "yoga_pilates",
  "mma", "recovery", "luxury", "cycling", "barre",
];
const VIBES = [
  "trendy", "aesthetic", "social", "serene", "old_school", "no_frills",
  "hardcore", "community", "beginner_friendly",
];
// Neighborhood vocabulary is PER-CITY (see src/lib/search/synonyms.ts, which
// this mirrors). Tampa has curated neighborhoods; Miami's "neighborhood"
// column holds raw municipalities (17/40 rows are literally "Miami"), so we
// deliberately do NOT build a Miami vocab — never-fabricate. Any city absent
// from this map (every basic-tier city today) gets [] and the model is told
// to always emit null for it, never guess against raw city_data.
const NEIGHBORHOODS_BY_CITY: Record<string, string[]> = {
  tampa: [
    "Downtown", "Channel District", "Hyde Park", "South Tampa", "Seminole Heights",
    "Ybor City", "Westshore", "Carrollwood", "North Tampa",
  ],
};
// City-specific mapping hints for the neighborhood line — only meaningful
// where we actually have a curated vocab.
const NEIGHBORHOOD_HINTS: Record<string, string> = {
  tampa: ` (map mentions like "SoHo"→"Hyde Park", "Channelside"→"Channel District", "USF"→"North Tampa", "Bayshore"→"South Tampa")`,
};
function neighborhoodsFor(citySlug: string): string[] {
  return NEIGHBORHOODS_BY_CITY[citySlug] ?? [];
}

function buildSystemPrompt(citySlug: string): string {
  const neighborhoods = neighborhoodsFor(citySlug);
  const neighborhoodLine =
    neighborhoods.length > 0
      ? `"neighborhood": string|null,      // only from: ${neighborhoods.join(", ")}${NEIGHBORHOOD_HINTS[citySlug] ?? ""}`
      : `"neighborhood": null,             // this city has no neighborhood vocabulary — ALWAYS null here, never guess or invent one`;
  return `You parse gym-search queries into filters. Output ONLY a JSON object — no prose, no markdown fences.

Schema:
{
  "amenities": string[],            // only from: ${AMENITIES.join(", ")}
  "equipment": {
    "keys": string[],               // only from: ${EQUIPMENT.join(", ")}
    "minSquatRacks": number|null,
    "minDumbbellWeight": number|null,   // lbs
    "brands": string[]              // equipment brand names mentioned (e.g. "Rogue", "Hammer Strength")
  },
  "maxDayPass": number|null,        // dollars, only if a price cap is stated
  "openNow": boolean,
  "open24h": boolean,
  ${neighborhoodLine}
  "segments": string[],             // only from: ${SEGMENTS.join(", ")} ("powerlifting"→strength, "box"→crossfit, "studio"→boutique, "high-end club"/"bougie"/"country club"→luxury, "spin"/"soulcycle"→cycling)
  "vibes": string[]                 // only from: ${VIBES.join(", ")} — atmosphere/style descriptors
}

Rules:
- Include items only when clearly stated or strongly implied; prefer omission over guessing; numbers must be positive integers.
- segments describe FACILITY TYPE. Emit one only when the user names a facility type ("crossfit box", "yoga studio", "climbing gym") or a type-defining activity ("powerlifting" → strength).
- CAPABILITY RULE: for training-activity intents, ALWAYS include the defining equipment keys — heavy lifting / powerlifting / strength → squat_rack, barbells, dumbbells; crossfit / WOD → platform, pull_up_bar; climbing / bouldering → climbing_wall; indoor cycling / spin → spin_bike. Equipment is ground truth; a wellness or yoga studio with nice amenities is NOT a lifting gym, and segment labels alone must never satisfy a training intent.
- amenities: only those explicitly requested.
- vibes capture atmosphere words: "instagram"/"instagrammable"/"influencer friendly" → trendy, aesthetic, social; "vibey" → serene, aesthetic; "gritty"/"no nonsense" → no_frills (add hardcore for "gritty"); "old school iron" → old_school; "welcoming"/"judgement free" → beginner_friendly; "fun"/"social scene" → social. Vibes are soft preferences, never requirements — emit them freely when atmosphere words appear, but never invent them from facility types alone.`;
}

type Json = Record<string, unknown>;
const json = (body: Json, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// per-isolate rate limit (best-effort; resets on cold start)
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n++;
  return h.n > 20;
}

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

// Durable abuse gate (llm_gate RPC): Postgres-backed per-IP/minute limit +
// global daily request ceiling + kill switch (app_flags.llm_enabled). The
// in-memory limiter above is only a cheap first bounce — per-isolate counters
// reset on cold start and multiply across isolates, so THIS is the real spend
// boundary. Fails CLOSED on RPC error: an unguarded paid-LLM call is never
// acceptable, and the client degrades to the local nlParser fallback anyway.
const AI_SEARCH_PER_MIN = 20;
const AI_SEARCH_DAILY_CAP = 5000;
async function durableGate(ip: string): Promise<"ok" | "rate_limited" | "budget_exceeded" | "disabled" | "error"> {
  try {
    // Inline client (same pattern as the get_secret Vault call) — a typed
    // cached client narrows rpc() args away from this project-defined function.
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await sb.rpc("llm_gate", {
      p_fn: "ai-search",
      p_ip: ip,
      p_per_min: AI_SEARCH_PER_MIN,
      p_daily_cap: AI_SEARCH_DAILY_CAP,
    });
    if (error || typeof data !== "string") return "error";
    return data as "ok" | "rate_limited" | "budget_exceeded" | "disabled";
  } catch {
    return "error";
  }
}

// undefined = not yet fetched · null = fetched, none configured
let cachedVaultKey: string | null | undefined;
async function getAnthropicKey(): Promise<string | null> {
  const envKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (envKey) return envKey;
  if (cachedVaultKey !== undefined) return cachedVaultKey;
  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await sb.rpc("get_secret", {
      secret_name: "ANTHROPIC_API_KEY",
    });
    cachedVaultKey =
      !error && typeof data === "string" && data.length > 0 ? data : null;
  } catch {
    cachedVaultKey = null;
  }
  return cachedVaultKey;
}

function sanitize(raw: Json, citySlug: string) {
  const eq = (raw.equipment ?? {}) as Json;
  const arr = (v: unknown, valid: string[]) =>
    (Array.isArray(v) ? v : []).filter(
      (x): x is string => typeof x === "string" && valid.includes(x),
    );
  const neighborhoods = neighborhoodsFor(citySlug);
  return {
    amenities: arr(raw.amenities, AMENITIES),
    equipment: {
      keys: arr(eq.keys, EQUIPMENT),
      minSquatRacks: num(eq.minSquatRacks),
      minDumbbellWeight: num(eq.minDumbbellWeight),
      brands: (Array.isArray(eq.brands) ? eq.brands : [])
        .filter((b): b is string => typeof b === "string" && b.length > 0 && b.length < 40)
        .slice(0, 5),
    },
    maxDayPass: num(raw.maxDayPass),
    openNow: raw.openNow === true,
    open24h: raw.open24h === true,
    // Forced empty for any city without a curated vocab (see
    // NEIGHBORHOODS_BY_CITY above) — defense in depth alongside the prompt
    // instruction, so a model slip can never surface a fabricated match.
    neighborhood:
      typeof raw.neighborhood === "string" && neighborhoods.includes(raw.neighborhood)
        ? raw.neighborhood
        : null,
    // NOTE: the web client maps this key to FilterSet.preferredSegments
    // (SOFT preference) — AI output never becomes a hard segment filter.
    segments: arr(raw.segments, SEGMENTS),
    // client maps to FilterSet.preferredVibes (SOFT — boosts, never excludes)
    vibes: arr(raw.vibes, VIBES),
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only", code: "METHOD" }, 405);
  if (!apikeyAuthorized(req)) {
    return json({ error: "apikey header required", code: "UNAUTHORIZED" }, 401);
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) return json({ error: "rate limited", code: "RATE_LIMITED" }, 429);
  const gate = await durableGate(ip);
  if (gate !== "ok") {
    if (gate === "rate_limited") return json({ error: "rate limited", code: "RATE_LIMITED" }, 429);
    // budget_exceeded / disabled / error — clients fall back to the local parser.
    return json({ error: "AI search is temporarily unavailable", code: "UNAVAILABLE" }, 503);
  }

  let query: unknown;
  let city: unknown;
  try {
    ({ query, city } = await req.json());
  } catch {
    return json({ error: "invalid JSON body", code: "INVALID_INPUT" }, 400);
  }
  if (typeof query !== "string" || query.trim().length === 0 || query.length > 300) {
    return json({ error: "query required (1–300 chars)", code: "INVALID_INPUT" }, 400);
  }
  // OPTIONAL, defaults to "tampa" — backward/forward compatible across the
  // ~75s Netlify deploy gap: an old client that never sends `city` still
  // gets Tampa's vocab (its only correct behavior), and an unrecognized/
  // absent slug just yields an empty neighborhood vocab (never fabricated).
  const citySlug =
    typeof city === "string" && city.trim().length > 0 ? city.trim().toLowerCase() : "tampa";

  const apiKey = await getAnthropicKey();
  if (!apiKey) return json({ error: "AI service not configured", code: "NO_AI_KEY" }, 503);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5",
        max_tokens: 600,
        temperature: 0,
        system: buildSystemPrompt(citySlug),
        messages: [{ role: "user", content: query }],
      }),
    });
    if (!res.ok) return json({ error: "AI request failed", code: "AI_ERROR" }, 503);
    const data = await res.json();
    const text: string = data?.content?.[0]?.text ?? "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) {
      return json({ error: "AI returned no JSON", code: "AI_PARSE" }, 503);
    }
    const parsed = JSON.parse(text.slice(start, end + 1)) as Json;
    return json({ filterSet: { ...sanitize(parsed, citySlug), rawQuery: query } }, 200);
  } catch {
    return json({ error: "AI parse failed", code: "AI_PARSE" }, 503);
  }
});
