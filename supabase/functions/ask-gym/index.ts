// Ask Scout — guardrailed gym Q&A. The LLM's ENTIRE output contract is
// { fact_ids: string[], intent, op, threshold } against a per-gym catalog of
// stable synthetic ids built from THIS gym's rows — it never sees any other
// gym's data, never emits a verdict, a claim, or a word of prose. `intent`
// classifies the question's logical SHAPE (exists/all/compare/open_on);
// `op`+`threshold` (compare only) carry the operator + number FROM the
// question. The verdict below is derived deterministically from the DB rows
// those ids resolve to (plus, for "compare", a real numeric comparison done
// HERE, never by the model) — "detail"/"value" strings are verbatim DB text,
// never LLM-paraphrased. Every model-returned id is also checked against an
// exact per-gym allowlist before it's ever resolved (see parseModelOutput).
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

// Durable abuse gate (llm_gate RPC): Postgres-backed per-IP/minute limit +
// global daily request ceiling + kill switch (app_flags.llm_enabled). The
// in-memory limiter above is only a cheap first bounce — per-isolate counters
// reset on cold start and multiply across isolates, so THIS is the real spend
// boundary. Fails CLOSED on RPC error: if the DB is unreachable the fact
// fetch would fail anyway, and an unguarded paid-LLM call is never acceptable.
const ASK_GYM_PER_MIN = 10;
const ASK_GYM_DAILY_CAP = 2000;
async function durableGate(ip: string): Promise<"ok" | "rate_limited" | "budget_exceeded" | "disabled" | "error"> {
  try {
    // Inline client (same pattern as the get_secret Vault call) — a typed
    // cached client narrows rpc() args away from this project-defined function.
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { data, error } = await sb.rpc("llm_gate", {
      p_fn: "ask-gym",
      p_ip: ip,
      p_per_min: ASK_GYM_PER_MIN,
      p_daily_cap: ASK_GYM_DAILY_CAP,
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
    sb
      .from("gyms")
      .select("id, day_pass_price, hours")
      .eq("id", gymId)
      // Public surfaces never answer questions about closed/relocated/deduped
      // gyms — same gate as fetchCityGyms/sitemap (src/lib/queries/gyms.ts);
      // the gym detail page 404s these, so ask-gym must never fabricate an
      // answer for a gym nobody can actually land on.
      .not("status", "in", "(closed,moved,duplicate)")
      .maybeSingle(),
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
{
  "fact_ids": string[],   // ids copied EXACTLY from the list above that answer the question — empty array if none do
  "intent": "exists" | "all" | "compare" | "open_on",
  "op": "lt" | "lte" | "gt" | "gte" | "eq" | null,   // ONLY for intent "compare" — else null
  "threshold": number | null                          // ONLY for intent "compare", the number FROM the question — else null
}

You NEVER decide yes/no yourself — you only classify the question's shape and cite ids. The server checks the real data and computes the answer.

intent meanings:
- "exists": one fact, or an "or" question ("Is there a pool or a sauna?", "Do you have a sauna?") — any single match answers it.
- "all": an "and"/compound question ("Does it have a pool and a sauna?") — return EVERY fact_id the question references, even ones you think are false or unlisted. Never drop one just because you suspect it's false.
- "compare": a numeric threshold question about a price ("Is the day pass under $20?", "Is the day pass more than $30?") — return exactly ONE fact_id, the operator, and the number from the question.
- "open_on": a specific day/hours question ("Are you open Saturday?", "What time do you close?") — cite gym:hours if it's listed.

Examples:
Q: "Is there a sauna?" -> {"fact_ids":["amenity:sauna"],"intent":"exists","op":null,"threshold":null}
Q: "Do you have a pool or a steam room?" -> {"fact_ids":["amenity:pool","amenity:steam_room"],"intent":"exists","op":null,"threshold":null}
Q: "Does it have a pool and a steam room?" -> {"fact_ids":["amenity:pool","amenity:steam_room"],"intent":"all","op":null,"threshold":null}
Q: "Is the day pass under $20?" -> {"fact_ids":["gym:day_pass_price"],"intent":"compare","op":"lt","threshold":20}
Q: "Are you open on Saturday?" -> {"fact_ids":["gym:hours"],"intent":"open_on","op":null,"threshold":null}
Q: "Is there a climbing wall?" (not in the list above) -> {"fact_ids":[],"intent":"exists","op":null,"threshold":null}

Rules:
- Only ever return ids that appear verbatim in the list above; never invent an id, never return an id for a fact not listed.
- If nothing in the list answers the question, return an empty array for fact_ids.
- Return at most 3 ids for "exists"/"open_on"/"compare"; for "all", return every referenced id (still capped at 6).
- "op"/"threshold" are ONLY set for "compare" — null for every other intent.`;
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

// ── Intent classification (WP-E) ─────────────────────────────────────────
// The LLM's contract grows by exactly one small, still-non-verdict field:
// which LOGICAL SHAPE the question has. It still never scores, never decides
// yes/no/not_listed — that stays 100% server-derived from resolved DB rows
// (CLAUDE.md rule 6). "compare" additionally carries an operator + the
// numeric threshold FROM THE QUESTION (e.g. "under $20" -> lt, 20) so the
// server — never the model — does the actual comparison against the real
// DB scalar.
type Intent = "exists" | "all" | "compare" | "open_on";
const VALID_INTENTS: readonly Intent[] = ["exists", "all", "compare", "open_on"];
type CompareOp = "lt" | "lte" | "gt" | "gte" | "eq";
const VALID_OPS: readonly CompareOp[] = ["lt", "lte", "gt", "gte", "eq"];

// The only numeric scalar in the whole catalog today. Compare intent is
// scoped to this — never let the model apply a numeric threshold to a
// boolean amenity/equipment/parking/transit fact (there is nothing numeric
// on those rows to compare against; see numericScalarOf).
const COMPARABLE_FACT_IDS = new Set<string>(["gym:day_pass_price"]);

function compareNumeric(value: number, op: CompareOp, threshold: number): boolean {
  switch (op) {
    case "lt":
      return value < threshold;
    case "lte":
      return value <= threshold;
    case "gt":
      return value > threshold;
    case "gte":
      return value >= threshold;
    case "eq":
      return value === threshold;
    default:
      // op is validated against VALID_OPS in parseModelOutput before this is
      // ever called — this branch is defense-in-depth, never reachable.
      return false;
  }
}

function numericScalarOf(id: string, facts: GymFacts): number | null {
  if (id === "gym:day_pass_price") return dayPassPriceOf(facts);
  return null;
}

interface ParsedModelOutput {
  factIds: string[];
  intent: Intent;
  op: CompareOp | null;
  threshold: number | null;
}

// Validates the model's ENTIRE output shape server-side. Anything malformed
// — wrong types, an intent outside the four named ones, a compare missing
// its operator/threshold/target — is rejected here and deriveAnswer degrades
// to cannot_answer; it never guesses at a shape the model didn't clearly
// produce.
//
// Exact catalog allowlist (WP-E #18): catalogIds is built from THIS gym's
// real catalog entries only. Every model-returned id is checked against it
// HERE, before anything downstream ever resolves an id — a well-formed but
// hallucinated id (e.g. "amenity:totally_made_up") is dropped at this gate,
// never humanized into a synthetic not_listed row. This is an ADDITIONAL
// gate on top of FACT_ID_RE/resolveFact's shape check, not a replacement.
function parseModelOutput(raw: unknown, catalogIds: Set<string>): ParsedModelOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const ids = (Array.isArray(r.fact_ids) ? r.fact_ids : [])
    .filter((x): x is string => typeof x === "string")
    .filter((id) => catalogIds.has(id))
    .filter((id, i, arr) => arr.indexOf(id) === i) // dedupe
    .slice(0, 6); // bound response size

  let intent: Intent | null = VALID_INTENTS.includes(r.intent as Intent) ? (r.intent as Intent) : null;
  if (intent === null) {
    // With 0–1 ids, "exists" and "all" aggregate identically — safe to
    // default. With 2+ ids and no reliable intent we cannot safely guess
    // AND vs OR; that ambiguity is exactly the compound-verdict bug this
    // fixes, so bail honest (cannot_answer) instead of guessing.
    if (ids.length <= 1) intent = "exists";
    else return null;
  }

  let op: CompareOp | null = null;
  let threshold: number | null = null;
  if (intent === "compare") {
    op = VALID_OPS.includes(r.op as CompareOp) ? (r.op as CompareOp) : null;
    threshold = typeof r.threshold === "number" && Number.isFinite(r.threshold) ? r.threshold : null;
    if (op === null || threshold === null || ids.length !== 1 || !COMPARABLE_FACT_IDS.has(ids[0])) {
      // Missing operator/threshold, more than one target, or a target that
      // isn't actually numeric — never let a malformed compare fall through
      // to a fabricated yes/no.
      return null;
    }
  }

  return { factIds: ids, intent, op, threshold };
}

function deriveAnswer(
  raw: unknown,
  facts: GymFacts,
  catalogIds: Set<string>,
): { verdict: string; factRefs: FactRefOut[] } {
  const parsed = parseModelOutput(raw, catalogIds);
  if (!parsed || parsed.factIds.length === 0) return { verdict: "cannot_answer", factRefs: [] };

  const resolved = parsed.factIds
    .map((id) => resolveFact(id, facts))
    .filter((r): r is NonNullable<typeof r> => r !== null);
  if (resolved.length === 0) return { verdict: "cannot_answer", factRefs: [] };

  if (parsed.intent === "compare") {
    // ids.length === 1 was already enforced in parseModelOutput.
    const only = resolved[0];
    if (only.status !== "yes") {
      // Nothing on file to compare against — never coerce an absent scalar
      // into a false comparison result; not_listed is the honest verdict.
      return { verdict: "not_listed", factRefs: [only.ref] };
    }
    const numeric = numericScalarOf(parsed.factIds[0], facts);
    if (numeric === null) {
      return { verdict: "not_listed", factRefs: [only.ref] };
    }
    // THE SERVER compares the real DB scalar to the threshold — the raw
    // value is never let to "stand in" for the verdict the way the old
    // code did (any resolved fact -> "yes", regardless of what was asked).
    const passes = compareNumeric(numeric, parsed.op!, parsed.threshold!);
    return { verdict: passes ? "yes" : "no", factRefs: [only.ref] };
  }

  if (parsed.intent === "all") {
    // AND/compound: every referenced fact must be yes. A definitive "no" on ANY
    // conjunct falsifies the whole AND — regardless of other unknown parts — so
    // it wins over a co-occurring not_listed (a confirmed absence already makes
    // "pool AND sauna" false even if a third part is unknown). Only when nothing
    // is a definitive "no" but something is unknown can we not confirm the
    // compound → cannot_answer. Either verdict names EVERY referenced fact so
    // the client can render each part honestly — never drop a conjunct.
    if (resolved.some((r) => r.status === "no")) {
      return { verdict: "no", factRefs: resolved.map((r) => r.ref) };
    }
    if (resolved.some((r) => r.status === "not_listed")) {
      return { verdict: "cannot_answer", factRefs: [] };
    }
    return { verdict: "yes", factRefs: resolved.map((r) => r.ref) };
  }

  // "exists" (a single fact, or an "or" question) and "open_on" (an hours
  // question — gym:hours is one scalar, so this collapses to the same
  // shape) share this any-yes-wins aggregation, matching "pool OR sauna"
  // semantics: finding one match answers the question, and a differently-
  // statused fact riding along is honestly omitted (never fabricated as
  // agreeing with a verdict it contradicts).
  const verdict = resolved.some((r) => r.status === "yes")
    ? "yes"
    : resolved.some((r) => r.status === "no")
      ? "no"
      : "not_listed";
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
  const gate = await durableGate(ip);
  if (gate !== "ok") {
    if (gate === "rate_limited") return json({ error: "rate limited", code: "RATE_LIMITED" }, 429);
    // budget_exceeded / disabled / error — the feature is off, not the user's fault.
    return json({ error: "Ask Scout is temporarily unavailable", code: "UNAVAILABLE" }, 503);
  }

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
  // Exact-catalog allowlist (WP-E #18) — see parseModelOutput.
  const catalogIds = new Set(catalog.map((c) => c.id));

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
    const parsedJson = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
    const answer = deriveAnswer(parsedJson, facts, catalogIds);
    return json({ answer }, 200);
  } catch {
    return json({ error: "AI parse failed", code: "AI_PARSE" }, 503);
  }
});
