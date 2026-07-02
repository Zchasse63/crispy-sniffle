/**
 * Owner-form answer diffing — THE shared equality / diff / visibility
 * implementation for the owner pipeline (CLAUDE.md rule 5: one impl per
 * concern). Used by:
 *  - parse.ts (server): differs-or-touched gate against the rebuilt baseline
 *  - OwnerFormShell (client): strip hidden fields at submit
 *  - ReviewScreen (client): "from public info" badge
 */
import type { AnswerMap, FieldAnswer } from "./answerTypes";
import { isAnswered } from "./answerTypes";
import { FORM_SECTIONS, visibleFields } from "./formConfig";
import type { GymSegment, HoursMap } from "@/lib/types/scout";

/** Fields patched by widgets but not declared in FORM_SECTIONS (the photo
 *  uploader owns the rights affirmation). They must survive stripping and
 *  count as known ids, or the affirmation is silently dropped at submit. */
const VIRTUAL_FIELD_IDS = ["i_photo_rights"] as const;

/** Every field id the form can legitimately produce. */
export const KNOWN_FIELD_IDS: ReadonlySet<string> = new Set([
  ...FORM_SECTIONS.flatMap((s) => s.fields.map((f) => f.id)),
  ...VIRTUAL_FIELD_IDS,
]);

/** Key-order-insensitive structural equality for JSON-serializable values.
 *  `undefined` object entries are ignored (a JSON round trip drops them). */
function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null || typeof a !== "object" || typeof b !== "object") return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepEqual(v, b[i]));
  }
  const ra = a as Record<string, unknown>;
  const rb = b as Record<string, unknown>;
  const ka = Object.keys(ra).filter((k) => ra[k] !== undefined);
  const kb = Object.keys(rb).filter((k) => rb[k] !== undefined);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => deepEqual(ra[k], rb[k]));
}

/** Drop any day tuple with a blank open OR close (a day toggled "Open" with no
 *  times is not a publishable window); open_24h never rides in the grid value.
 *  Returns null when nothing complete remains. */
export function sanitizeHours(v: HoursMap | null): HoursMap | null {
  if (!v) return null;
  const out: Record<string, [string, string]> = {};
  for (const [day, tuple] of Object.entries(v)) {
    if (day === "open_24h") continue; // the grid owns day windows only
    if (
      Array.isArray(tuple) &&
      typeof tuple[0] === "string" &&
      typeof tuple[1] === "string" &&
      tuple[0] !== "" &&
      tuple[1] !== ""
    ) {
      out[day] = [tuple[0], tuple[1]];
    }
  }
  return Object.keys(out).length > 0 ? (out as HoursMap) : null;
}

/** Kind-aware structural equality between two answers. Two empty/skipped
 *  answers (either undefined or unanswered) are equal — "no signal" on both
 *  sides is not a difference. Mismatched kinds are never equal. */
export function answerEquals(a: FieldAnswer | undefined, b: FieldAnswer | undefined): boolean {
  const aAns = !!a && isAnswered(a);
  const bAns = !!b && isAnswered(b);
  if (!aAns && !bAns) return true;
  if (!aAns || !bAns || !a || !b || a.kind !== b.kind) return false;
  switch (a.kind) {
    case "text":
      return b.kind === "text" && a.value.trim() === b.value.trim();
    case "num":
      return b.kind === "num" && a.value === b.value;
    case "choice":
      return b.kind === "choice" && a.value === b.value;
    case "tri":
      return b.kind === "tri" && a.value === b.value;
    case "chips": {
      if (b.kind !== "chips") return false;
      const sa = new Set(a.value);
      const sb = new Set(b.value);
      return sa.size === sb.size && [...sa].every((k) => sb.has(k));
    }
    case "hours":
      return b.kind === "hours" && deepEqual(sanitizeHours(a.value), sanitizeHours(b.value));
    case "plans":
      return b.kind === "plans" && deepEqual(a.value, b.value);
    case "photo":
      return b.kind === "photo" && deepEqual(a.value, b.value);
  }
}

/** Set diff between the current chip selection and the baseline selection. */
export function chipSetDiff(
  current: string[],
  baseline: string[],
): { added: string[]; removed: string[]; kept: string[] } {
  const cur = new Set(current);
  const base = new Set(baseline);
  return {
    added: [...cur].filter((k) => !base.has(k)),
    removed: [...base].filter((k) => !cur.has(k)),
    kept: [...cur].filter((k) => base.has(k)),
  };
}

/** Keep only the answers for fields visible given the segment + current
 *  answers (branches AND showIf, across ALL sections) — the generalized
 *  stripHiddenEquipment. Unknown/tampered keys are dropped; the virtual
 *  photo-rights field rides with the photos widget and is preserved. */
export function stripHiddenFields(answers: AnswerMap, segment: GymSegment | null): AnswerMap {
  const out: AnswerMap = {};
  for (const section of FORM_SECTIONS) {
    for (const f of visibleFields(section, segment, answers)) {
      if (answers[f.id] !== undefined) out[f.id] = answers[f.id];
    }
  }
  for (const id of VIRTUAL_FIELD_IDS) {
    if (answers[id] !== undefined) out[id] = answers[id];
  }
  return out;
}
