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

/** Escape a synonym phrase for use inside a RegExp body. */
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Word-boundary phrase match: `(^|\W)phrase(\W|$)` semantics on already-
 * lowercased, space-normalized text. Multi-word phrases still match across
 * spaces. Prevents substring collisions like "running track"→squat_rack
 * ("rack"), "good energy"→rower ("erg"), "spine corrector"→cycling ("spin").
 */
export function phraseMatches(text: string, phrase: string): boolean {
  return firstPhraseSpan(text, phrase) !== null;
}

/** First `(^|\W)phrase(\W|$)` span in text, or null. */
function firstPhraseSpan(
  text: string,
  phrase: string,
): { start: number; end: number } | null {
  const p = phrase.trim().toLowerCase();
  if (!p) return null;
  // Capture leading sep + phrase; end asserted (not consumed) so adjacent
  // matches stay findable if we ever scan for multiples.
  const re = new RegExp(`(^|\\W)(${escapeRegExp(p)})(?=\\W|$)`, "i");
  const m = re.exec(text);
  if (!m || m.index === undefined || m[2] === undefined) return null;
  const start = m.index + m[1].length;
  return { start, end: start + m[2].length };
}

type PhraseKind = "amenity" | "equipment" | "segment";

/**
 * Longest-phrase-first match across amenity/equipment/segment synonym dicts,
 * with non-overlapping span claiming. Word-boundary alone fixes mid-token
 * collisions ("track"/"rack"); span claiming fixes whole-word collisions where
 * a longer multi-word phrase (e.g. equipment "box jumps") must win over a
 * shorter segment synonym ("box" → crossfit).
 */
function matchSynonymDicts(text: string): {
  amenities: AmenityKey[];
  equipment: EquipmentKey[];
  segments: GymSegment[];
} {
  type Cand = {
    kind: PhraseKind;
    key: string;
    phraseLen: number;
    start: number;
    end: number;
  };

  const cands: Cand[] = [];

  const collect = <K extends string>(
    dict: Record<K, string[]>,
    kind: PhraseKind,
  ) => {
    for (const key of Object.keys(dict) as K[]) {
      // Per-key longest first so we only emit one span candidate per key
      // (the strongest phrase that actually appears).
      const phrases = [...dict[key]].sort((a, b) => b.length - a.length);
      for (const phrase of phrases) {
        const span = firstPhraseSpan(text, phrase);
        if (span) {
          cands.push({
            kind,
            key,
            phraseLen: phrase.trim().length,
            start: span.start,
            end: span.end,
          });
          break;
        }
      }
    }
  };

  collect(AMENITY_SYNONYMS, "amenity");
  collect(EQUIPMENT_SYNONYMS, "equipment");
  collect(SEGMENT_SYNONYMS, "segment");

  // Global longest-phrase-first, then earlier span as tie-break.
  cands.sort((a, b) => b.phraseLen - a.phraseLen || a.start - b.start);

  const claimed: { start: number; end: number }[] = [];
  const overlaps = (s: number, e: number) =>
    claimed.some((c) => s < c.end && e > c.start);

  const amenities = new Set<AmenityKey>();
  const equipment = new Set<EquipmentKey>();
  const segments = new Set<GymSegment>();

  for (const c of cands) {
    if (overlaps(c.start, c.end)) continue;
    claimed.push({ start: c.start, end: c.end });
    if (c.kind === "amenity") amenities.add(c.key as AmenityKey);
    else if (c.kind === "equipment") equipment.add(c.key as EquipmentKey);
    else segments.add(c.key as GymSegment);
  }

  return {
    amenities: [...amenities],
    equipment: [...equipment],
    segments: [...segments],
  };
}

export function parseQueryLocally(query: string, citySlug: string): FilterSet {
  const text = ` ${query.toLowerCase().replace(/\s+/g, " ").trim()} `;

  const matched = matchSynonymDicts(text);
  const amenities = matched.amenities;
  let equipmentKeys = matched.equipment;
  // Activity mentions become SOFT preferences — never hard filters.
  const preferredSegments = matched.segments;
  // Vibe descriptors are SOFT too ("trendy", "vibey" — boost, never exclude).
  const preferredVibes: VibeTag[] = [];
  for (const [term, tags] of Object.entries(VIBE_SYNONYMS)) {
    if (phraseMatches(text, term)) {
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
    !phraseMatches(text, "power rack") &&
    !phraseMatches(text, "power cage")
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
  const brands = KNOWN_BRANDS.filter((b) => phraseMatches(text, b)).map((b) =>
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
    if (synonyms.some((s) => phraseMatches(text, s))) {
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
