/**
 * Shared provenance-ladder helpers for the data loaders (scripts/*.mjs).
 *
 * Ladder (highest wins - mirrors PROVENANCE_META in src/lib/types/scout.ts;
 * keep these two ranks in sync if the ladder ever changes):
 *   owner:6 > scout_verified:5 > user:4 > scraped:3
 *     > seed:2 = osm:2 = city_data:2 > estimated:1
 *
 * A lower-ranked source must NEVER overwrite or delete a higher-ranked fact.
 * This is a plain ESM module (no TS import, no npm deps) so every loader can
 * pull it in with a relative import regardless of how it's invoked.
 */

export const SOURCE_RANK = {
  owner: 6,
  scout_verified: 5,
  user: 4,
  scraped: 3,
  seed: 2,
  osm: 2,
  city_data: 2,
  estimated: 1,
};

/** Unknown/undefined/null source ranks below every real tier (0). */
export function rank(source) {
  return SOURCE_RANK[source] ?? 0;
}

/** True only if the incoming source may write over the existing one -
 *  equal rank is allowed (a source may refresh its own data). A missing
 *  existing row/fact (null/undefined existingSource) is always writable -
 *  there's nothing yet to protect. */
export function canOverwrite(incomingSource, existingSource) {
  if (existingSource === null || existingSource === undefined) return true;
  return rank(incomingSource) >= rank(existingSource);
}

/** True only for a well-formed 24h clock string "HH:MM" - both fields
 *  exactly two digits, 00<=HH<=24, 00<=MM<=59. HH===24 is allowed ONLY with
 *  MM===00 - the app's documented end-of-day sentinel (CLAUDE.md: "hours
 *  close time '00:00'/'24:00' means end-of-day"). Rejects malformed values
 *  like "99:99", "25:00", "9:00" (must be zero-padded), "24:30". */
export function isValidClock(str) {
  if (typeof str !== "string") return false;
  const m = /^(\d{2}):(\d{2})$/.exec(str);
  if (!m) return false;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh < 0 || hh > 24) return false;
  if (mm < 0 || mm > 59) return false;
  if (hh === 24 && mm !== 0) return false;
  return true;
}
