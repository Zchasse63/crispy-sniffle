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

// NOTE: open_24h is deliberately NOT in this list — 24-hour intent flows
// exclusively through the open24h boolean (single source of truth).
const AMENITIES = [
  "sauna", "cold_plunge", "steam_room", "pool", "recovery_room",
  "classes", "personal_training", "turf_area", "cardio_zone", "basketball_court",
  "day_pass", "parking", "lockers", "showers", "towel_service", "wifi",
  "juice_bar", "childcare",
];
const EQUIPMENT = [
  "squat_rack", "power_rack", "platform", "dumbbells", "barbells", "kettlebells",
  "ghd", "sled", "ski_erg", "assault_bike", "rower", "reverse_hyper", "belt_squat",
  "comp_bench", "cable_machine", "leg_press", "smith_machine", "hack_squat",
  "pull_up_bar", "dip_station", "monolift", "climbing_wall",
];
const SEGMENTS = [
  "strength", "crossfit", "big_box", "boutique", "climbing", "yoga_pilates",
  "mma", "recovery", "luxury",
];
const VIBES = [
  "trendy", "aesthetic", "social", "serene", "old_school", "no_frills",
  "hardcore", "community", "beginner_friendly",
];
const NEIGHBORHOODS = [
  "Downtown", "Channel District", "Hyde Park", "South Tampa", "Seminole Heights",
  "Ybor City", "Westshore", "Carrollwood", "North Tampa",
];

const SYSTEM = `You parse gym-search queries into filters. Output ONLY a JSON object — no prose, no markdown fences.

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
  "neighborhood": string|null,      // only from: ${NEIGHBORHOODS.join(", ")} (map mentions like "SoHo"→"Hyde Park", "Channelside"→"Channel District", "USF"→"North Tampa", "Bayshore"→"South Tampa")
  "segments": string[],             // only from: ${SEGMENTS.join(", ")} ("powerlifting"→strength, "box"→crossfit, "studio"→boutique, "high-end club"/"bougie"/"country club"→luxury)
  "vibes": string[]                 // only from: ${VIBES.join(", ")} — atmosphere/style descriptors
}

Rules:
- Include items only when clearly stated or strongly implied; prefer omission over guessing; numbers must be positive integers.
- segments describe FACILITY TYPE. Emit one only when the user names a facility type ("crossfit box", "yoga studio", "climbing gym") or a type-defining activity ("powerlifting" → strength).
- CAPABILITY RULE: for training-activity intents, ALWAYS include the defining equipment keys — heavy lifting / powerlifting / strength → squat_rack, barbells, dumbbells; crossfit / WOD → platform, pull_up_bar; climbing / bouldering → climbing_wall. Equipment is ground truth; a wellness or yoga studio with nice amenities is NOT a lifting gym, and segment labels alone must never satisfy a training intent.
- amenities: only those explicitly requested.
- vibes capture atmosphere words: "instagram"/"instagrammable"/"influencer friendly" → trendy, aesthetic, social; "vibey" → serene, aesthetic; "gritty"/"no nonsense" → no_frills (add hardcore for "gritty"); "old school iron" → old_school; "welcoming"/"judgement free" → beginner_friendly; "fun"/"social scene" → social. Vibes are soft preferences, never requirements — emit them freely when atmosphere words appear, but never invent them from facility types alone.`;

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

function sanitize(raw: Json) {
  const eq = (raw.equipment ?? {}) as Json;
  const arr = (v: unknown, valid: string[]) =>
    (Array.isArray(v) ? v : []).filter(
      (x): x is string => typeof x === "string" && valid.includes(x),
    );
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
    neighborhood:
      typeof raw.neighborhood === "string" && NEIGHBORHOODS.includes(raw.neighborhood)
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
  if (!req.headers.get("apikey")) {
    return json({ error: "apikey header required", code: "UNAUTHORIZED" }, 401);
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) return json({ error: "rate limited", code: "RATE_LIMITED" }, 429);

  let query: unknown;
  try {
    ({ query } = await req.json());
  } catch {
    return json({ error: "invalid JSON body", code: "INVALID_INPUT" }, 400);
  }
  if (typeof query !== "string" || query.trim().length === 0 || query.length > 300) {
    return json({ error: "query required (1–300 chars)", code: "INVALID_INPUT" }, 400);
  }

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
        system: SYSTEM,
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
    return json({ filterSet: { ...sanitize(parsed), rawQuery: query } }, 200);
  } catch {
    return json({ error: "AI parse failed", code: "AI_PARSE" }, 503);
  }
});
