/**
 * NL query → FilterSet orchestration.
 * Primary: ai-search edge function (Claude parses language → filters).
 * Fallback: deterministic local parser — the app NEVER hard-depends on the LLM.
 * Every remote response is sanitized against the known key catalogs before use.
 */
import {
  EMPTY_FILTER_SET,
  SEGMENT_CAPABILITIES,
  type AmenityKey,
  type EquipmentKey,
  type FilterSet,
  type GymSegment,
  VIBE_TAGS,
  type VibeTag,
} from "@/lib/types/scout";
import { AMENITY_SYNONYMS, EQUIPMENT_SYNONYMS, SEGMENT_SYNONYMS, getNeighborhoods } from "./synonyms";
import { parseQueryLocally } from "./nlParser";

const VALID_AMENITIES = new Set(Object.keys(AMENITY_SYNONYMS));
const VALID_EQUIPMENT = new Set(Object.keys(EQUIPMENT_SYNONYMS));
const VALID_SEGMENTS = new Set(Object.keys(SEGMENT_SYNONYMS));
// Neighborhood validity is per-city — computed inside sanitize() per call,
// never module-level (there is no single flat vocabulary anymore).

export type ParseResult = { filterSet: FilterSet; via: "ai" | "fallback" };

function num(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.round(v) : null;
}

function sanitize(raw: unknown, query: string, citySlug: string): FilterSet | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const eq = (r.equipment ?? {}) as Record<string, unknown>;
  const validNeighborhoods = new Set(Object.keys(getNeighborhoods(citySlug)));

  const amenities = (Array.isArray(r.amenities) ? r.amenities : [])
    .filter((a): a is AmenityKey => typeof a === "string" && VALID_AMENITIES.has(a));
  const keys = (Array.isArray(eq.keys) ? eq.keys : [])
    .filter((k): k is EquipmentKey => typeof k === "string" && VALID_EQUIPMENT.has(k));
  // AI-inferred facility types are SOFT preferences (the Kodawari rule);
  // capability equipment implied by them is unioned in.
  const preferredSegments = (Array.isArray(r.segments) ? r.segments : [])
    .filter((s): s is GymSegment => typeof s === "string" && VALID_SEGMENTS.has(s));
  for (const seg of preferredSegments) {
    for (const cap of SEGMENT_CAPABILITIES[seg] ?? []) {
      if (!keys.includes(cap)) keys.push(cap);
    }
  }
  const brands = (Array.isArray(eq.brands) ? eq.brands : [])
    .filter((b): b is string => typeof b === "string" && b.length > 0 && b.length < 40)
    .slice(0, 5);
  const neighborhood =
    typeof r.neighborhood === "string" && validNeighborhoods.has(r.neighborhood)
      ? r.neighborhood
      : null;

  return {
    ...EMPTY_FILTER_SET,
    amenities: amenities.filter((a) => a !== "open_24h"),
    equipment: {
      keys,
      minSquatRacks: num(eq.minSquatRacks),
      minDumbbellWeight: num(eq.minDumbbellWeight),
      brands,
    },
    maxDayPass: num(r.maxDayPass),
    openNow: r.openNow === true,
    // the boolean is the sole source of truth (the amenity key is for the
    // local parser's synonym matching only)
    open24h: r.open24h === true,
    neighborhood,
    segments: [], // hard segments come only from explicit rail action
    preferredSegments,
    preferredVibes: (Array.isArray(r.vibes) ? r.vibes : []).filter(
      (v: unknown): v is VibeTag => typeof v === "string" && (VIBE_TAGS as readonly string[]).includes(v),
    ),
    rawQuery: query,
  };
}

/**
 * @param citySlug Threaded into the edge fn request body ("city") so the
 *   prompt/validation there use THIS city's neighborhood vocabulary — and
 *   into the local fallback parser for the same reason. Deploy-window
 *   compat: `city` is optional server-side (an old edge fn ignores it and
 *   behaves exactly as before, which is only ever correct for Tampa; a new
 *   edge fn defaults a missing/absent `city` to "tampa" too), so client and
 *   edge tolerate either side being mid-deploy for the ~75s Netlify gap.
 */
export async function parseQuery(query: string, citySlug: string): Promise<ParseResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (url && key) {
    try {
      const res = await fetch(`${url}/functions/v1/ai-search`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: key,
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ query, city: citySlug }),
        signal: AbortSignal.timeout(8000),
      });
      if (res.ok) {
        const data = (await res.json()) as { filterSet?: unknown };
        const cleaned = sanitize(data.filterSet, query, citySlug);
        if (cleaned) return { filterSet: cleaned, via: "ai" };
      }
    } catch {
      // fall through to local parser
    }
  }
  return { filterSet: parseQueryLocally(query, citySlug), via: "fallback" };
}
