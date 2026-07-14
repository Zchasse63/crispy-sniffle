/**
 * Deterministic fallback parser: natural language → FilterSet.
 * Used when the ai-search edge function is unavailable (no key, timeout,
 * network error). Synonym/phrase matching, longest phrase first.
 */
import {
  EMPTY_FILTER_SET,
  SEGMENT_CAPABILITIES,
  type AmenityKey,
  type EquipmentKey,
  type FilterSet,
  type GymSegment,
  type VibeTag,
} from "@/lib/types/scout";
import {
  AMENITY_SYNONYMS,
  EQUIPMENT_SYNONYMS,
  KNOWN_BRANDS,
  getNeighborhoods,
  SEGMENT_SYNONYMS,
  VIBE_SYNONYMS,
} from "./synonyms";

function findMatches<K extends string>(
  text: string,
  dict: Record<K, string[]>,
): K[] {
  const hits = new Set<K>();
  for (const key of Object.keys(dict) as K[]) {
    // longest phrase first so "power rack" beats "rack"
    const phrases = [...dict[key]].sort((a, b) => b.length - a.length);
    for (const phrase of phrases) {
      if (text.includes(phrase)) {
        hits.add(key);
        break;
      }
    }
  }
  return [...hits];
}

export function parseQueryLocally(query: string, citySlug: string): FilterSet {
  const text = ` ${query.toLowerCase().replace(/\s+/g, " ").trim()} `;

  const amenities = findMatches<AmenityKey>(text, AMENITY_SYNONYMS);
  let equipmentKeys = findMatches<EquipmentKey>(text, EQUIPMENT_SYNONYMS);
  // Activity mentions become SOFT preferences — never hard filters.
  const preferredSegments = findMatches<GymSegment>(text, SEGMENT_SYNONYMS);
  // Vibe descriptors are SOFT too ("trendy", "vibey" — boost, never exclude).
  const preferredVibes: VibeTag[] = [];
  for (const [term, tags] of Object.entries(VIBE_SYNONYMS)) {
    if (text.includes(term)) {
      for (const t of tags) if (!preferredVibes.includes(t)) preferredVibes.push(t);
    }
  }

  // Capability mapping: activity intent implies ground-truth equipment.
  // "Heavy lifting" must surface places you can actually lift (racks/bars),
  // not merely places labeled a certain way — and exclude amenity-only
  // studios from training queries naturally.
  for (const seg of preferredSegments) {
    for (const cap of SEGMENT_CAPABILITIES[seg] ?? []) {
      if (!equipmentKeys.includes(cap)) equipmentKeys.push(cap);
    }
  }

  // "rack(s)" alone maps to squat_rack; drop power_rack duplicate unless explicit
  if (
    equipmentKeys.includes("squat_rack") &&
    equipmentKeys.includes("power_rack") &&
    !text.includes("power rack") &&
    !text.includes("power cage")
  ) {
    equipmentKeys = equipmentKeys.filter((k) => k !== "power_rack");
  }

  // Price: "under $20", "less than 25", "$15 day pass", "max 30"
  let maxDayPass: number | null = null;
  const priceMatch =
    text.match(/(?:under|less than|below|max|cheaper than|at most)\s*\$?\s*(\d{1,3})\b/) ||
    text.match(/\$\s*(\d{1,3})\s*(?:day pass|\/day|a day|per day|or less)/);
  if (priceMatch) maxDayPass = Number(priceMatch[1]);

  // Dumbbell weight: "dumbbells over 120", "150 lb dumbbells", "dumbbells up to 200 lbs"
  let minDumbbellWeight: number | null = null;
  const dbMatch =
    text.match(/dumbbells?\s+(?:over|above|past|up to|to|of)\s+(\d{2,3})\s*(?:lb|lbs|pounds?)?/) ||
    text.match(/(\d{2,3})\s*(?:lb|lbs|pound)\s+dumbbells?/) ||
    (text.includes("heavy dumbbell") ? (["", "100"] as RegExpMatchArray) : null);
  if (dbMatch) {
    minDumbbellWeight = Number(dbMatch[1]);
    if (!equipmentKeys.includes("dumbbells")) equipmentKeys.push("dumbbells");
  }

  // Squat rack count: "at least 4 racks", "4+ squat racks", "multiple racks"
  let minSquatRacks: number | null = null;
  const rackMatch =
    text.match(/(?:at least|minimum of|min)\s+(\d{1,2})\s+(?:squat |power )?racks/) ||
    text.match(/(\d{1,2})\s*\+\s*(?:squat |power )?racks/) ||
    text.match(/(\d{1,2})\s+(?:squat |power )racks/);
  if (rackMatch) {
    minSquatRacks = Number(rackMatch[1]);
  } else if (/(multiple|several|plenty of|lots of)\s+(?:squat |power )?racks/.test(text)) {
    minSquatRacks = 3;
  }
  if (minSquatRacks !== null && !equipmentKeys.includes("squat_rack")) {
    equipmentKeys.push("squat_rack");
  }

  // Brands
  const brands = KNOWN_BRANDS.filter((b) => text.includes(b)).map((b) =>
    b
      .split(" ")
      .map((w) => w[0].toUpperCase() + w.slice(1))
      .join(" "),
  );

  // Hours
  const open24h = amenities.includes("open_24h");
  const openNow = /open now|open right now|currently open|open at the moment/.test(text);

  // Neighborhood — per-city vocabulary. Basic-tier cities (Miami, etc.) have
  // no curated vocab, so getNeighborhoods() returns {} and neighborhood stays
  // null here: never fabricate a match against a city's raw municipality data.
  let neighborhood: string | null = null;
  for (const [canonical, synonyms] of Object.entries(getNeighborhoods(citySlug))) {
    if (synonyms.some((s) => text.includes(s))) {
      neighborhood = canonical;
      break;
    }
  }

  return {
    ...EMPTY_FILTER_SET,
    amenities: amenities.filter((a) => a !== "open_24h"), // 24h handled by flag
    equipment: {
      keys: equipmentKeys,
      minSquatRacks,
      minDumbbellWeight,
      brands,
    },
    maxDayPass,
    openNow,
    open24h,
    neighborhood,
    segments: [], // hard segment filters come only from explicit rail action
    preferredSegments,
    preferredVibes,
    rawQuery: query,
  };
}
