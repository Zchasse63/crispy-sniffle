import type { EnrichedGym } from "@/lib/types/scout";

/**
 * Minimal structural subset both the public `EnrichedGym` (this file's
 * import) and the admin `gyms` table Row satisfy. `hours` is widened to
 * `unknown` because `EnrichedGym` stores it as a parsed `HoursMap` while the
 * raw DB row types it as `Json` — completeness only checks presence, never
 * shape, so the looser type is the correct fix, not a shortcut. Everything
 * else is a straight `Pick` off `EnrichedGym`, so the admin caller (whose row
 * shape happens to line up field-for-field) satisfies this without
 * `src/lib/admin/gyms-admin.ts` needing to import from here or vice versa
 * introducing an admin type into this public-surface lib.
 */
export type CompletenessFields = Pick<
  EnrichedGym,
  | "address"
  | "phone"
  | "website"
  | "segment"
  | "description"
  | "photo_url"
  | "neighborhood"
  | "monthly_from"
  | "day_pass_price"
> & { hours: unknown };

/** Fields counted toward a gym's completeness score (name is always present). */
const CORE_FIELDS: (keyof CompletenessFields)[] = [
  "address",
  "phone",
  "website",
  "segment",
  "description",
  "photo_url",
  "neighborhood",
  "hours",
  "monthly_from",
  "day_pass_price",
];

/**
 * Percentage (0-100) of CORE_FIELDS present (non-null, non-undefined,
 * non-empty-string) on a gym record. Shared by the admin data-quality
 * cockpit (src/lib/admin/gyms-admin.ts) and the public browse-order scorer
 * (src/lib/scoring/scorer.ts) — one implementation per concern (repo
 * CLAUDE.md rule 5).
 */
export function completeness(gym: CompletenessFields): number {
  const present = CORE_FIELDS.filter((f) => {
    const v = gym[f];
    return v !== null && v !== undefined && v !== "";
  }).length;
  return Math.round((present / CORE_FIELDS.length) * 100);
}
