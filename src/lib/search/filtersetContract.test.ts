/**
 * FilterSet four-surface contract (CLAUDE.md non-negotiable #4 / audit P1#9).
 *
 * Surfaces:
 *   1. scout.ts label maps (runtime key sets)
 *   2. synonyms.ts dict keys
 *   3. ai-search edge function literal arrays (read as text)
 *   4. DB amenities catalog snapshot (amenities.db-snapshot.json — no live env)
 *
 * Known deliberate exception: open_24h is in scout/synonyms/DB but absent from
 * the edge AMENITIES list (24h intent flows through the open24h boolean).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  AMENITY_LABELS,
  EQUIPMENT_LABELS,
  SEGMENT_LABELS,
} from "@/lib/types/scout";
import {
  AMENITY_SYNONYMS,
  EQUIPMENT_SYNONYMS,
  SEGMENT_SYNONYMS,
} from "@/lib/search/synonyms";
import dbSnapshot from "@/lib/search/amenities.db-snapshot.json";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const EDGE_PATH = join(ROOT, "supabase/functions/ai-search/index.ts");

/** Extract a `const NAME = [ ... ];` string-literal array from edge source. */
function extractStringArray(source: string, constName: string): string[] {
  const re = new RegExp(
    `const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s*;`,
  );
  const m = source.match(re);
  if (!m) {
    throw new Error(
      `Could not locate const ${constName} = [...] in ${EDGE_PATH}. ` +
        `If the edge fn was refactored, update filtersetContract.test.ts parser.`,
    );
  }
  const keys = [...m[1].matchAll(/"([a-z0-9_]+)"/g)].map((x) => x[1]);
  if (keys.length === 0) {
    throw new Error(
      `const ${constName} array parsed empty — check quoting in edge source.`,
    );
  }
  return keys;
}

function sorted(xs: Iterable<string>): string[] {
  return [...xs].sort();
}

function setDiff(a: Set<string>, b: Set<string>): string[] {
  return sorted([...a].filter((k) => !b.has(k)));
}

describe("FilterSet four-surface contract", () => {
  const scoutAmenities = new Set(Object.keys(AMENITY_LABELS));
  const scoutEquipment = new Set(Object.keys(EQUIPMENT_LABELS));
  const scoutSegments = new Set(Object.keys(SEGMENT_LABELS));

  const synonymAmenities = new Set(Object.keys(AMENITY_SYNONYMS));
  const synonymEquipment = new Set(Object.keys(EQUIPMENT_SYNONYMS));
  const synonymSegments = new Set(Object.keys(SEGMENT_SYNONYMS));

  const edgeSrc = readFileSync(EDGE_PATH, "utf8");
  const edgeAmenities = new Set(extractStringArray(edgeSrc, "AMENITIES"));
  const edgeEquipment = new Set(extractStringArray(edgeSrc, "EQUIPMENT"));
  const edgeSegments = new Set(extractStringArray(edgeSrc, "SEGMENTS"));

  const dbAmenities = new Set(
    (dbSnapshot as { keys: string[] }).keys.filter((k) => !k.startsWith("_")),
  );

  it("scout.ts amenities match synonyms keys 1:1", () => {
    expect(sorted(synonymAmenities)).toEqual(sorted(scoutAmenities));
  });

  it("scout.ts equipment match synonyms keys 1:1", () => {
    expect(sorted(synonymEquipment)).toEqual(sorted(scoutEquipment));
  });

  it("scout.ts segments match synonyms keys 1:1", () => {
    expect(sorted(synonymSegments)).toEqual(sorted(scoutSegments));
  });

  it("edge EQUIPMENT matches scout (no exceptions)", () => {
    expect(sorted(edgeEquipment)).toEqual(sorted(scoutEquipment));
  });

  it("edge SEGMENTS matches scout (no exceptions)", () => {
    expect(sorted(edgeSegments)).toEqual(sorted(scoutSegments));
  });

  it("edge AMENITIES matches scout except deliberate open_24h omission", () => {
    const onlyInScout = setDiff(scoutAmenities, edgeAmenities);
    const onlyInEdge = setDiff(edgeAmenities, scoutAmenities);
    expect(onlyInScout).toEqual(["open_24h"]);
    expect(onlyInEdge).toEqual([]);
  });

  it("DB amenities snapshot matches scout.ts AMENITY_LABELS 1:1", () => {
    // Surface 4: checked-in snapshot from migrations (no live Supabase env).
    // When an amenities migration lands, regenerate amenities.db-snapshot.json.
    expect(sorted(dbAmenities)).toEqual(sorted(scoutAmenities));
  });

  it("DB snapshot has the expected migration-derived cardinality (32)", () => {
    // 19 base + cafe + coworking + womens_area + womens_only + 9 backfill = 32
    expect(dbAmenities.size).toBe(32);
    expect(scoutAmenities.size).toBe(32);
  });
});
