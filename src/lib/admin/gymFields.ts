import { SEGMENT_LABELS } from "@/lib/types/scout";
import { GYM_STATUS_LABELS, DROP_IN_LABELS } from "@/lib/types/scout";
import { DISCOUNT_COLUMNS } from "@/lib/owner/parse";

/** Editor input kind for a scalar gym column. */
export type GymFieldType =
  | "text"
  | "textarea"
  | "number"
  | "currency"
  | "boolean" // tri-state: true / false / null(=Unlisted)
  | "segment"
  | "status"
  | "dropin";

export interface GymFieldDef {
  key: string;
  label: string;
  type: GymFieldType;
  /** longer hint shown under the field */
  hint?: string;
  /** boolean column is NOT NULL (no "Unlisted" state) */
  twoState?: boolean;
  /** value is required — cannot be set to null/Unlisted */
  required?: boolean;
}

export interface GymFieldGroup {
  group: string;
  fields: GymFieldDef[];
}

/** The single source of truth for which scalar gym columns are editable in the
 *  inspector AND accepted by the PATCH handler. jsonb/structured fields
 *  (membership_plans, class_packs, hours, early_termination) are intentionally
 *  read-only in MVP — their structured editors are v2. */
export const GYM_FIELD_GROUPS: GymFieldGroup[] = [
  {
    group: "Identity & contact",
    fields: [
      { key: "name", label: "Name", type: "text", required: true },
      { key: "neighborhood", label: "Neighborhood", type: "text" },
      { key: "address", label: "Address", type: "text" },
      { key: "phone", label: "Phone", type: "text" },
      { key: "website", label: "Website", type: "text" },
      { key: "instagram", label: "Instagram", type: "text", hint: "handle or profile URL" },
      { key: "photo_url", label: "Hero photo URL", type: "text" },
      { key: "description", label: "Description", type: "textarea" },
    ],
  },
  {
    group: "Classification",
    fields: [
      { key: "segment", label: "Segment", type: "segment" },
      { key: "status", label: "Lifecycle status", type: "status", required: true },
      { key: "verified", label: "Scout-verified", type: "boolean", twoState: true, required: true },
      { key: "lat", label: "Latitude", type: "number" },
      { key: "lng", label: "Longitude", type: "number" },
    ],
  },
  {
    group: "Core pricing",
    fields: [
      { key: "monthly_from", label: "Monthly from", type: "currency" },
      { key: "monthly_note", label: "Monthly note", type: "text" },
      { key: "day_pass_price", label: "Day pass", type: "currency" },
      { key: "week_pass_price", label: "Week pass", type: "currency" },
      { key: "single_class_price", label: "Single class", type: "currency" },
      { key: "enrollment_fee", label: "Enrollment fee", type: "currency" },
      { key: "annual_fee", label: "Annual fee", type: "currency" },
      { key: "annual_fee_label", label: "Annual fee label", type: "text" },
    ],
  },
  {
    group: "Commitment & access",
    fields: [
      { key: "min_commitment_months", label: "Min commitment (months)", type: "number" },
      { key: "no_contract_option", label: "Month-to-month available", type: "boolean" },
      { key: "cancellation_notice_days", label: "Cancellation notice (days)", type: "number" },
      { key: "freeze_policy", label: "Freeze policy", type: "text" },
      { key: "intro_offer", label: "Intro offer", type: "text" },
      { key: "app_required_entry", label: "App required for entry", type: "boolean" },
      { key: "waitlist", label: "Waitlist", type: "boolean" },
      { key: "drop_in_policy", label: "Drop-in policy", type: "dropin" },
      { key: "drop_in_note", label: "Drop-in note", type: "text" },
      { key: "members_guest_note", label: "Guest note", type: "text" },
      { key: "pricing_notes", label: "Pricing notes", type: "textarea" },
    ],
  },
  {
    group: "Discounts",
    fields: [
      { key: "student_discount", label: "Student discount", type: "boolean" },
      { key: "military_discount", label: "Military discount", type: "boolean" },
      { key: "senior_discount", label: "Senior discount", type: "boolean" },
      { key: "corporate_discount", label: "Corporate discount", type: "boolean" },
      { key: "family_plans", label: "Family plans", type: "boolean" },
    ],
  },
];

export const EDITABLE_GYM_FIELDS: Record<string, GymFieldDef> = Object.fromEntries(
  GYM_FIELD_GROUPS.flatMap((g) => g.fields).map((f) => [f.key, f]),
);

/** Option lists for the select-style fields. */
export const SEGMENT_OPTIONS = Object.entries(SEGMENT_LABELS).map(([value, label]) => ({ value, label }));
export const STATUS_OPTIONS = Object.entries(GYM_STATUS_LABELS).map(([value, label]) => ({ value, label }));
export const DROPIN_OPTIONS = Object.entries(DROP_IN_LABELS).map(([value, label]) => ({ value, label }));

/** Minimal shape the inspector's field-source derivation needs from a
 *  gym_edit_log row (see deriveFieldSources below). */
export interface GymEditLogEntry {
  field: string | null;
  source: string | null;
  new_value: unknown;
}

/** Commitment-term chip keys that map to the min_commitment_months column
 *  (mirrors the "changed months" mapping in
 *  app/admin/api/owner-queue/[id]/publish/route.ts's commitment case — keep
 *  in sync if that route's month-term set ever changes). */
const COMMITMENT_MONTH_TERMS = new Set(["3_month", "6_month", "12_month"]);

/** Derive each editable gym field's CURRENT provenance source from
 *  gym_edit_log rows (caller must pass them newest-first — only the first
 *  entry seen per column wins).
 *
 *  Two writers log two incompatible key conventions, both normalized here:
 *  - Admin hand-edits (app/admin/api/gyms/[id]/route.ts) log the bare column
 *    name, source: "scout_verified".
 *  - Owner publishes (app/admin/api/owner-queue/[id]/publish/route.ts) log
 *    "scalar:<column>" / "bool:<column>" for single-column facts, source:
 *    "owner"; the two multi-column grouped facts ("discounts", "commitment")
 *    log a single key whose new_value carries an {on, off} chip-key payload —
 *    expanded here into the specific columns it touched via DISCOUNT_COLUMNS
 *    (discounts) or COMMITMENT_MONTH_TERMS/"month_to_month" (commitment).
 *
 *  A field absent from the log has never been hand-edited or owner-published
 *  since its original load — returns undefined (never treated as "owner"). */
export function deriveFieldSources(entries: GymEditLogEntry[]): Record<string, string | null> {
  const result: Record<string, string | null> = {};
  const setOnce = (column: string, source: string | null) => {
    if (!(column in EDITABLE_GYM_FIELDS)) return; // not an inspector-editable column — irrelevant here
    if (!(column in result)) result[column] = source;
  };
  for (const e of entries) {
    if (!e.field) continue;
    if (e.field.startsWith("scalar:")) {
      setOnce(e.field.slice("scalar:".length), e.source);
    } else if (e.field.startsWith("bool:")) {
      setOnce(e.field.slice("bool:".length), e.source);
    } else if (e.field === "discounts") {
      const v = e.new_value as { on?: string[]; off?: string[] } | null;
      for (const k of [...(v?.on ?? []), ...(v?.off ?? [])]) {
        const col = DISCOUNT_COLUMNS[k];
        if (col) setOnce(col, e.source);
      }
    } else if (e.field === "commitment") {
      const v = e.new_value as { on?: string[]; off?: string[] } | null;
      const terms = [...(v?.on ?? []), ...(v?.off ?? [])];
      if (terms.includes("month_to_month")) setOnce("no_contract_option", e.source);
      if (terms.some((t) => COMMITMENT_MONTH_TERMS.has(t))) setOnce("min_commitment_months", e.source);
    } else {
      // Bare column name — the admin-PATCH convention.
      setOnce(e.field, e.source);
    }
  }
  return result;
}
