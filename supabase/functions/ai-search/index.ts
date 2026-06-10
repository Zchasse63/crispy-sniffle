// Scout ai-search — natural language → FilterSet (strict JSON contract).
// The LLM ONLY parses language into filters. Scoring stays deterministic
// client-side. No key configured → 503 → client falls back to its local
// parser, so the app never hard-depends on this function.
//
// Deployed with verify_jwt=false because new-format publishable keys are
// not JWTs; auth here = apikey header required + rate limit + input caps.
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const AMENITIES = [
  "sauna", "cold_plunge", "steam_room", "pool", "recovery_room", "open_24h",
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
  "mma", "recovery",
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
  "segments": string[]              // only from: ${SEGMENTS.join(", ")} ("powerlifting"→strength, "box"→crossfit, "studio"→boutique)
}

Rules: include items only when clearly stated or strongly implied; prefer omission over guessing; numbers must be positive integers.`;

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

function sanitize(raw: Json) {
  const eq = (raw.equipment ?? {}) as Json;
  const arr = (v: unknown, valid: string[]) =>
    (Array.isArray(v) ? v : []).filter(
      (x): x is string => typeof x === "string" && valid.includes(x),
    );
  return {
    amenities: arr(raw.amenities, AMENITIES).filter((a) => a !== "open_24h"),
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
    open24h:
      raw.open24h === true ||
      (Array.isArray(raw.amenities) && raw.amenities.includes("open_24h")),
    neighborhood:
      typeof raw.neighborhood === "string" && NEIGHBORHOODS.includes(raw.neighborhood)
        ? raw.neighborhood
        : null,
    segments: arr(raw.segments, SEGMENTS),
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

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
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
