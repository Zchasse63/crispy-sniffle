// Ask Scout — guardrailed gym Q&A. The LLM's ENTIRE output contract is
// { fact_ids: string[] } (empty = cannot answer) against a per-gym catalog of
// stable synthetic ids built from THIS gym's rows — it never sees any other
// gym's data, never emits a verdict, a claim, or a word of prose. The verdict
// below is derived deterministically from the DB rows those ids resolve to;
// "detail"/"value" strings are verbatim DB text, never LLM-paraphrased.
//
// Separate function from ai-search (own scaffolding copy, not shared code),
// but same conventions: verify_jwt=false (publishable keys aren't JWTs);
// auth here = apikey header + rate limit + input caps. Rate limit is
// TIGHTER than ai-search's (10/min/IP vs 20) since this fires per gym-detail
// pageview, not just on explicit search.
//
// Anthropic key resolution: ANTHROPIC_API_KEY env secret wins if set;
// otherwise falls back to Supabase Vault via the service-role-only
// public.get_secret() RPC (see vault_secret_accessor migration) — identical
// to ai-search. Facts are fetched with a SEPARATE service-role client
// (never trusts client-posted facts — the client only ever sends
// { gymId, question }).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type Json = Record<string, unknown>;
const json = (body: Json, status: number) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });

// per-isolate rate limit (best-effort; resets on cold start) — tighter than
// ai-search's 20/min/IP: this fires per gym-detail pageview, not just on
// explicit search intent.
const hits = new Map<string, { n: number; t: number }>();
function rateLimited(ip: string): boolean {
  const now = Date.now();
  const h = hits.get(ip);
  if (!h || now - h.t > 60_000) {
    hits.set(ip, { n: 1, t: now });
    return false;
  }
  h.n++;
  return h.n > 10;
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

// Separate, cached service-role client for fact fetching (own concern from
// the Vault RPC client above, even though the credentials are the same env
// vars) — this is the ONLY thing that ever reads gym facts; the client never
// posts facts to this function, only { gymId, question }.
let serviceClient: ReturnType<typeof createClient> | null = null;
function getServiceClient() {
  if (!serviceClient) {
    serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  }
  return serviceClient;
}

interface GymScalarRow {
  id: string;
  day_pass_price: string | number | null;
  hours: unknown;
}
interface AmenityRow {
  amenity_key: string;
  present: boolean;
  source: string;
  confidence: string | number;
  detail: string | null;
}
interface EquipmentRow {
  equipment_key: string;
  brand: string | null;
  quantity: number | null;
  max_weight_lbs: number | null;
  source: string;
  confidence: string | number;
  detail: string | null;
}
interface ParkingRow {
  id: string;
  name: string | null;
  fee_detail: string | null;
  source: string;
  confidence: string | number;
  detail: string | null;
}
interface TransitRow {
  id: string;
  name: string | null;
  kind: string;
  source: string;
  confidence: string | number;
  detail: string | null;
}
interface GymFacts {
  gym: GymScalarRow | null;
  amenities: AmenityRow[];
  equipment: EquipmentRow[];
  parking: ParkingRow[];
  transit: TransitRow[];
}

async function fetchGymFacts(gymId: string): Promise<GymFacts> {
  const sb = getServiceClient();
  const [gymRes, amenitiesRes, equipmentRes, parkingRes, transitRes] = await Promise.all([
    sb.from("gyms").select("id, day_pass_price, hours").eq("id", gymId).maybeSingle(),
    sb.from("gym_amenities").select("amenity_key, present, source, confidence, detail").eq("gym_id", gymId),
    sb
      .from("gym_equipment")
      .select("equipment_key, brand, quantity, max_weight_lbs, source, confidence, detail")
      .eq("gym_id", gymId),
    sb.from("gym_parking").select("id, name, fee_detail, source, confidence, detail").eq("gym_id", gymId),
    sb.from("gym_transit").select("id, name, kind, source, confidence, detail").eq("gym_id", gymId),
  ]);
  if (gymRes.error || amenitiesRes.error || equipmentRes.error || parkingRes.error || transitRes.error) {
    throw new Error("db_error");
  }
  return {
    gym: (gymRes.data as GymScalarRow | null) ?? null,
    amenities: (amenitiesRes.data as AmenityRow[] | null) ?? [],
    equipment: (equipmentRes.data as EquipmentRow[] | null) ?? [],
    parking: (parkingRes.data as ParkingRow[] | null) ?? [],
    transit: (transitRes.data as TransitRow[] | null) ?? [],
  };
}

function humanize(key: string): string {
  return key
    .split("_")
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function dayPassPriceOf(facts: GymFacts): number | null {
  const raw = facts.gym?.day_pass_price;
  return raw !== null && raw !== undefined ? Number(raw) : null;
}
function hasHours(facts: GymFacts): boolean {
  return facts.gym?.hours !== null && facts.gym?.hours !== undefined;
}

interface CatalogEntry {
  id: string;
  label: string;
}

// Sparse catalog: only THIS gym's actual rows (both present:true and
// present:false amenities — a stated absence is a real fact, not an unknown)
// plus the two gym scalars when non-null. Never the full site-wide taxonomy.
function buildCatalog(facts: GymFacts): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const a of facts.amenities) {
    entries.push({ id: `amenity:${a.amenity_key}`, label: humanize(a.amenity_key) });
  }
  for (const e of facts.equipment) {
    entries.push({ id: `equipment:${e.equipment_key}`, label: humanize(e.equipment_key) });
  }
  for (const p of facts.parking) {
    entries.push({ id: `parking:${p.id}`, label: p.name ? `Parking — ${p.name}` : "Parking" });
  }
  for (const t of facts.transit) {
    entries.push({ id: `transit:${t.id}`, label: t.name ? `Transit — ${t.name}` : `Transit (${humanize(t.kind)})` });
  }
  if (dayPassPriceOf(facts) !== null) entries.push({ id: "gym:day_pass_price", label: "Day pass price" });
  if (hasHours(facts)) entries.push({ id: "gym:hours", label: "Hours" });
  return entries;
}

function buildSystemPrompt(catalog: CatalogEntry[]): string {
  const lines = catalog.map((c) => `${c.id} — ${c.label}`).join("\n");
  return `You match a visitor's question about ONE gym to the facts Scout has on file for that gym. Output ONLY a JSON object — no prose, no markdown fences.

Facts on file for this gym (id — label):
${lines}

Schema:
{ "fact_ids": string[] }   // ids copied EXACTLY from the list above that answer the question — empty array if none do

Rules:
- Only ever return ids that appear verbatim in the list above; never invent an id, never return an id for a fact not listed.
- If nothing in the list answers the question, return an empty array — never guess.
- Return at most 3 ids: the most directly relevant ones.`;
}

// Hallucination guard: the model was only ever shown catalog ids, but its
// output is never trusted blindly — same spirit as "never trusts
// client-posted facts". Anything not matching this shape, or not resolving
// to a real row/scalar, is silently dropped.
const FACT_ID_RE = /^(amenity|equipment|parking|transit):[A-Za-z0-9_-]+$|^gym:(day_pass_price|hours)$/;

type Verdict = "yes" | "no" | "not_listed";
interface FactRefOut {
  id: string;
  label: string;
  value: string | null;
  source: string | null;
  confidence: number | null;
  detail: string | null;
}
const EMPTY_REF = (id: string, label: string): FactRefOut => ({
  id,
  label,
  value: null,
  source: null,
  confidence: null,
  detail: null,
});

// Per-fact-type verdict resolution. IMPORTANT: equipment/parking/transit/the
// two gym scalars have no "confirmed absent" column at all (existence IS the
// fact) — they can only ever resolve 'yes' or 'not_listed', never 'no'. Only
// amenities carry a real present:true/false boolean.
function resolveFact(id: string, facts: GymFacts): { status: Verdict; ref: FactRefOut } | null {
  if (!FACT_ID_RE.test(id)) return null;

  if (id === "gym:day_pass_price") {
    const price = dayPassPriceOf(facts);
    return price === null
      ? { status: "not_listed", ref: EMPTY_REF(id, "Day pass price") }
      : { status: "yes", ref: { ...EMPTY_REF(id, "Day pass price"), value: `$${price}` } };
  }
  if (id === "gym:hours") {
    return hasHours(facts)
      ? { status: "yes", ref: EMPTY_REF(id, "Hours") }
      : { status: "not_listed", ref: EMPTY_REF(id, "Hours") };
  }

  const sep = id.indexOf(":");
  const prefix = id.slice(0, sep);
  const rest = id.slice(sep + 1);

  if (prefix === "amenity") {
    const row = facts.amenities.find((a) => a.amenity_key === rest);
    if (!row) return { status: "not_listed", ref: EMPTY_REF(id, humanize(rest)) };
    return {
      status: row.present ? "yes" : "no",
      ref: { id, label: humanize(rest), value: null, source: row.source, confidence: Number(row.confidence), detail: row.detail },
    };
  }
  if (prefix === "equipment") {
    const row = facts.equipment.find((e) => e.equipment_key === rest);
    if (!row) return { status: "not_listed", ref: EMPTY_REF(id, humanize(rest)) };
    const parts: string[] = [];
    if (row.quantity && row.quantity > 1) parts.push(`${row.quantity}×`);
    if (row.max_weight_lbs) parts.push(`to ${row.max_weight_lbs} lbs`);
    if (row.brand) parts.push(row.brand);
    return {
      status: "yes",
      ref: {
        id,
        label: humanize(rest),
        value: parts.length > 0 ? parts.join(" · ") : null,
        source: row.source,
        confidence: Number(row.confidence),
        detail: row.detail,
      },
    };
  }
  if (prefix === "parking") {
    const row = facts.parking.find((p) => p.id === rest);
    if (!row) return { status: "not_listed", ref: EMPTY_REF(id, "Parking") };
    return {
      status: "yes",
      ref: {
        id,
        label: row.name ? `Parking — ${row.name}` : "Parking",
        value: row.fee_detail,
        source: row.source,
        confidence: Number(row.confidence),
        detail: row.detail,
      },
    };
  }
  if (prefix === "transit") {
    const row = facts.transit.find((t) => t.id === rest);
    if (!row) return { status: "not_listed", ref: EMPTY_REF(id, "Transit") };
    return {
      status: "yes",
      ref: {
        id,
        label: row.name ? `Transit — ${row.name}` : humanize(row.kind),
        value: null,
        source: row.source,
        confidence: Number(row.confidence),
        detail: row.detail,
      },
    };
  }
  return null;
}

function deriveAnswer(rawIds: unknown, facts: GymFacts): { verdict: string; factRefs: FactRefOut[] } {
  const ids = (Array.isArray(rawIds) ? rawIds : [])
    .filter((x): x is string => typeof x === "string")
    .filter((id, i, arr) => arr.indexOf(id) === i) // dedupe
    .slice(0, 6); // bound response size
  const resolved = ids
    .map((id) => resolveFact(id, facts))
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (resolved.length === 0) return { verdict: "cannot_answer", factRefs: [] };
  const verdict = resolved.some((r) => r.status === "yes")
    ? "yes"
    : resolved.some((r) => r.status === "no")
      ? "no"
      : "not_listed";
  // The client's sentence template reads factRefs[0] as THE fact the single
  // top-level verdict describes. A compound question (e.g. "pool or sauna?")
  // can resolve facts with DIFFERENT statuses (pool absent, sauna present) —
  // only surface the ones that agree with the aggregate verdict, so the
  // rendered sentence can never be contradicted by a differently-statused
  // fact riding along in the same response (never-fabricate: an omitted fact
  // is honest; a same-list fact implying the opposite of the sentence isn't).
  const factRefs = resolved.filter((r) => r.status === verdict).map((r) => r.ref);
  return { verdict, factRefs };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "POST only", code: "METHOD" }, 405);
  if (!req.headers.get("apikey")) {
    return json({ error: "apikey header required", code: "UNAUTHORIZED" }, 401);
  }
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (rateLimited(ip)) return json({ error: "rate limited", code: "RATE_LIMITED" }, 429);

  let gymId: unknown;
  let question: unknown;
  try {
    ({ gymId, question } = await req.json());
  } catch {
    return json({ error: "invalid JSON body", code: "INVALID_INPUT" }, 400);
  }
  if (typeof gymId !== "string" || gymId.trim().length === 0) {
    return json({ error: "gymId required", code: "INVALID_INPUT" }, 400);
  }
  if (typeof question !== "string" || question.trim().length === 0 || question.length > 300) {
    return json({ error: "question required (1–300 chars)", code: "INVALID_INPUT" }, 400);
  }
  const trimmedQuestion = question.trim();

  let facts: GymFacts;
  try {
    facts = await fetchGymFacts(gymId);
  } catch {
    return json({ error: "database lookup failed", code: "DB_ERROR" }, 500);
  }
  if (!facts.gym) return json({ error: "gym not found", code: "NOT_FOUND" }, 404);

  const catalog = buildCatalog(facts);
  // Nothing to reference for this gym — never call the model with an empty
  // catalog (there is nothing it could possibly cite).
  if (catalog.length === 0) {
    return json({ answer: { verdict: "cannot_answer", factRefs: [] } }, 200);
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
        max_tokens: 200,
        temperature: 0,
        system: buildSystemPrompt(catalog),
        messages: [{ role: "user", content: trimmedQuestion }],
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
    const parsed = JSON.parse(text.slice(start, end + 1)) as { fact_ids?: unknown };
    const answer = deriveAnswer(parsed.fact_ids, facts);
    return json({ answer }, 200);
  } catch {
    return json({ error: "AI parse failed", code: "AI_PARSE" }, 503);
  }
});
