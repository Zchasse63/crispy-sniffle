/**
 * Owner-form answer state.
 *
 * Designed so the later backend step can convert an AnswerMap into
 * GymAmenityRecord[] / GymEquipmentRecord[] / GymParkingRecord[] at the
 * `owner` provenance tier by substituting source:'owner' — and so the whole
 * thing is JSON-serializable (becomes the `raw_answers jsonb` column).
 *
 * NEVER-FABRICATE: a skipped/unknown answer stays null/empty → "unlisted".
 * present:false is emitted ONLY when a prefilled chip was actively removed
 * (handled at conversion time by diffing against the prefill map).
 */

/** Tri-state: null = not answered/unknown (NOT the same as explicit "No"). */
export type TriState = true | false | null;

/** A membership plan as the owner enters it — convertible to scout.ts
 *  MembershipPlan at submit. Form-friendly: fixed 3 commitment columns. */
export interface PlanDraft {
  name: string;
  usageType: MembershipUsageType | null;
  usageCount: number | null;
  /** monthly price per commitment term; null = that term not offered. */
  prices: { term: CommitmentTerm; monthly: number | null }[];
}

/** An uploaded photo: storage path + public URL + optional subject tag. */
export interface PhotoEntry {
  path: string;
  url: string;
  tag?: string;
}

export type FieldAnswer =
  | { kind: "chips"; value: string[] }
  | { kind: "choice"; value: string | null }
  | { kind: "tri"; value: TriState }
  | { kind: "num"; value: number | null }
  | { kind: "text"; value: string }
  | { kind: "hours"; value: HoursMap | null }
  | { kind: "plans"; value: PlanDraft[] }
  | { kind: "photo"; value: PhotoEntry[] };

/** fieldId → answer. Flat + JSON-serializable. */
export type AnswerMap = Record<string, FieldAnswer>;

import type { CommitmentTerm, HoursMap, MembershipUsageType } from "@/lib/types/scout";

/** True when the owner has given a real signal for this field (not a skip). */
export function isAnswered(a: FieldAnswer | undefined): boolean {
  if (!a) return false;
  switch (a.kind) {
    case "chips":
      return a.value.length > 0;
    case "choice":
      return a.value !== null;
    case "tri":
      return a.value !== null;
    case "num":
      return a.value !== null;
    case "text":
      return a.value.trim().length > 0;
    case "hours":
      // a day toggled "Open" with no times entered (["",""]) is not a real answer
      return (
        a.value !== null &&
        Object.values(a.value).some((v) => Array.isArray(v) && v[0] !== "" && v[1] !== "")
      );
    case "plans":
      return a.value.some((p) => p.name.trim().length > 0 || p.prices.some((pr) => pr.monthly !== null));
    case "photo":
      return a.value.length > 0;
  }
}
