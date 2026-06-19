/**
 * Convert an owner AnswerMap into a reviewable parsed-facts diff (the inverse of
 * prefill.ts). Each fact carries the proposed value, the current value, and a
 * machine-readable `target` so the publish handler can apply it at the `owner`
 * provenance tier. Only ANSWERED fields produce facts — a skip stays unlisted.
 */
import type { AnswerMap, FieldAnswer, PlanDraft } from "./answerTypes";
import { isAnswered } from "./answerTypes";
import { FORM_SECTIONS } from "./formConfig";
import type { EnrichedGym, EquipmentKey, AmenityKey } from "@/lib/types/scout";
import { EQUIPMENT_LABELS, AMENITY_LABELS } from "@/lib/types/scout";

export type FactTarget =
  | { type: "scalar"; column: string }
  | { type: "bool"; column: string }
  | { type: "discounts" }
  | { type: "commitment" }
  | { type: "amenitySet" }
  | { type: "equipmentSet" }
  | { type: "equipmentAttr"; equipmentKey: string; attr: "quantity" | "max_weight_lbs" }
  | { type: "hours" }
  | { type: "plans" }
  | { type: "vibes" };

export interface ParsedFact {
  key: string;
  group: string;
  label: string;
  target: FactTarget;
  newValue: unknown;
  oldValue: unknown;
  /** changes an existing non-null value (the reviewer should look closely) */
  conflict: boolean;
}

export interface ParseResult {
  facts: ParsedFact[];
  factCount: number;
  conflictCount: number;
}

interface ScalarDef {
  column: string;
  kind: "text" | "num" | "choice";
  label: string;
  group: string;
}

const SCALAR_MAP: Record<string, ScalarDef> = {
  a_name: { column: "name", kind: "text", label: "Name", group: "Identity" },
  a_address: { column: "address", kind: "text", label: "Address", group: "Identity" },
  a_phone: { column: "phone", kind: "text", label: "Phone", group: "Identity" },
  a_website: { column: "website", kind: "text", label: "Website", group: "Identity" },
  a_segment: { column: "segment", kind: "choice", label: "Segment", group: "Identity" },
  c_dropin: { column: "drop_in_policy", kind: "choice", label: "Drop-in policy", group: "Pricing" },
  c_guest_model: { column: "guest_policy_model", kind: "choice", label: "Guest policy", group: "Pricing" },
  c_members_guest_note: { column: "members_guest_note", kind: "text", label: "Guest note", group: "Pricing" },
  c_daypass: { column: "day_pass_price", kind: "num", label: "Day pass", group: "Pricing" },
  c_weekpass: { column: "week_pass_price", kind: "num", label: "Week pass", group: "Pricing" },
  c_single_class: { column: "single_class_price", kind: "num", label: "Single class", group: "Pricing" },
  c_monthly: { column: "monthly_from", kind: "num", label: "Monthly from", group: "Pricing" },
  c_intro_offer: { column: "intro_offer", kind: "text", label: "Intro offer", group: "Pricing" },
  c_notes: { column: "pricing_notes", kind: "text", label: "Pricing notes", group: "Pricing" },
  m_enrollment_fee: { column: "enrollment_fee", kind: "num", label: "Enrollment fee", group: "Membership" },
  m_annual_fee: { column: "annual_fee", kind: "num", label: "Annual fee", group: "Membership" },
  m_annual_fee_label: { column: "annual_fee_label", kind: "text", label: "Annual fee label", group: "Membership" },
  m_cancel_days: { column: "cancellation_notice_days", kind: "num", label: "Cancellation notice (days)", group: "Membership" },
  m_freeze: { column: "freeze_policy", kind: "text", label: "Freeze policy", group: "Membership" },
};

const DISCOUNT_COLUMNS: Record<string, string> = {
  student: "student_discount",
  military: "military_discount",
  senior: "senior_discount",
  corporate: "corporate_discount",
  family: "family_plans",
};

function answerScalar(a: FieldAnswer | undefined): string | number | null {
  if (!a) return null;
  if (a.kind === "text") return a.value.trim() || null;
  if (a.kind === "num") return a.value;
  if (a.kind === "choice") return a.value;
  return null;
}

function gymVal(gym: EnrichedGym, column: string): unknown {
  const v = (gym as unknown as Record<string, unknown>)[column];
  return v ?? null;
}

/** Build the set of equipment-field ids so we can collect equipment keys. */
const EQUIPMENT_FIELD_IDS = new Set(
  FORM_SECTIONS.flatMap((s) => s.fields).filter((f) => f.equipmentField).map((f) => f.id),
);

export function parseSubmission(answers: AnswerMap, gym: EnrichedGym): ParseResult {
  const facts: ParsedFact[] = [];
  const push = (f: Omit<ParsedFact, "conflict"> & { conflict?: boolean }) =>
    facts.push({ ...f, conflict: f.conflict ?? false });

  // 1) Scalars
  for (const [fieldId, def] of Object.entries(SCALAR_MAP)) {
    const a = answers[fieldId];
    if (!isAnswered(a)) continue;
    const newValue = answerScalar(a);
    if (newValue === null) continue;
    const oldValue = gymVal(gym, def.column);
    const oldComparable = def.kind === "num" && oldValue !== null ? Number(oldValue) : oldValue;
    push({
      key: `scalar:${def.column}`,
      group: def.group,
      label: def.label,
      target: { type: "scalar", column: def.column },
      newValue,
      oldValue,
      conflict: oldComparable !== null && oldComparable !== newValue,
    });
  }

  // 2) tri-state booleans
  for (const [fieldId, column, label] of [
    ["m_app_required", "app_required_entry", "App required for entry"],
    ["m_waitlist", "waitlist", "Waitlist"],
  ] as const) {
    const a = answers[fieldId];
    if (a?.kind === "tri" && a.value !== null) {
      const oldValue = gymVal(gym, column);
      push({
        key: `bool:${column}`,
        group: "Membership",
        label,
        target: { type: "bool", column },
        newValue: a.value,
        oldValue,
        conflict: oldValue !== null && oldValue !== a.value,
      });
    }
  }

  // 3) Discounts (one grouped fact → 5 booleans)
  const disc = answers["m_discounts"];
  if (disc?.kind === "chips" && disc.value.length > 0) {
    const selected = disc.value.filter((k) => k in DISCOUNT_COLUMNS);
    const current = Object.entries(DISCOUNT_COLUMNS)
      .filter(([, col]) => gymVal(gym, col) === true)
      .map(([key]) => key);
    push({
      key: "discounts",
      group: "Membership",
      label: "Discounts",
      target: { type: "discounts" },
      newValue: selected,
      oldValue: current,
      conflict: false,
    });
  }

  // 4) Commitment terms
  const commit = answers["m_commitment"];
  if (commit?.kind === "chips" && commit.value.length > 0) {
    push({
      key: "commitment",
      group: "Membership",
      label: "Commitment terms",
      target: { type: "commitment" },
      newValue: commit.value,
      oldValue: {
        min_commitment_months: gym.min_commitment_months,
        no_contract_option: gym.no_contract_option,
      },
      conflict: false,
    });
  }

  // 5) Amenities (additive — d_amenities + g_womens + g_accessibility)
  const amenityKeys = new Set<string>();
  const dAmen = answers["d_amenities"];
  if (dAmen?.kind === "chips") dAmen.value.forEach((k) => amenityKeys.add(k));
  const gWomens = answers["g_womens"];
  if (gWomens?.kind === "choice" && gWomens.value) amenityKeys.add(gWomens.value);
  const gAcc = answers["g_accessibility"];
  if (gAcc?.kind === "chips") gAcc.value.forEach((k) => amenityKeys.add(k));
  if (amenityKeys.size > 0) {
    const present = new Set(gym.amenities.filter((x) => x.present).map((x) => x.amenity_key));
    const list = [...amenityKeys];
    push({
      key: "amenities",
      group: "Amenities",
      label: `Amenities (${list.length})`,
      target: { type: "amenitySet" },
      newValue: list,
      oldValue: list.filter((k) => present.has(k as AmenityKey)).length,
      conflict: false,
    });
  }

  // 6) Equipment set (union of all equipment-field answers)
  const equipKeys = new Set<string>();
  for (const fieldId of EQUIPMENT_FIELD_IDS) {
    const a = answers[fieldId];
    if (a?.kind === "chips") a.value.forEach((k) => equipKeys.add(k));
  }
  if (equipKeys.size > 0) {
    const present = new Set(gym.equipment.map((e) => e.equipment_key));
    const list = [...equipKeys];
    push({
      key: "equipment",
      group: "Equipment",
      label: `Equipment (${list.length})`,
      target: { type: "equipmentSet" },
      newValue: list,
      oldValue: list.filter((k) => present.has(k as EquipmentKey)).length,
      conflict: false,
    });
  }

  // 7) Equipment attributes (counts / max weight)
  const squat = answers["e_squat_count"];
  if (squat?.kind === "num" && squat.value !== null) {
    push({
      key: "equip-attr:squat_rack:quantity",
      group: "Equipment",
      label: "Squat racks (count)",
      target: { type: "equipmentAttr", equipmentKey: "squat_rack", attr: "quantity" },
      newValue: squat.value,
      oldValue: gym.equipment.find((e) => e.equipment_key === "squat_rack")?.quantity ?? null,
      conflict: false,
    });
  }
  const dbMax = answers["e_db_max"];
  if (dbMax?.kind === "num" && dbMax.value !== null) {
    push({
      key: "equip-attr:dumbbells:max_weight_lbs",
      group: "Equipment",
      label: "Dumbbell max (lb)",
      target: { type: "equipmentAttr", equipmentKey: "dumbbells", attr: "max_weight_lbs" },
      newValue: dbMax.value,
      oldValue: gym.equipment.find((e) => e.equipment_key === "dumbbells")?.max_weight_lbs ?? null,
      conflict: false,
    });
  }

  // 8) Hours
  const hours = answers["b_hours"];
  if (isAnswered(hours) && hours?.kind === "hours") {
    push({
      key: "hours",
      group: "Hours",
      label: "Staffed hours",
      target: { type: "hours" },
      newValue: hours.value,
      oldValue: gym.hours,
      conflict: gym.hours !== null,
    });
  }

  // 9) Membership plans
  const plans = answers["m_plans"];
  if (isAnswered(plans) && plans?.kind === "plans") {
    push({
      key: "plans",
      group: "Membership",
      label: `Membership plans (${plans.value.filter((p) => p.name.trim()).length})`,
      target: { type: "plans" },
      newValue: plans.value,
      oldValue: gym.membership_plans?.length ?? 0,
      conflict: (gym.membership_plans?.length ?? 0) > 0,
    });
  }

  // 10) Vibe tags (soft — boost only)
  const vibes = answers["h_vibes"];
  if (vibes?.kind === "chips" && vibes.value.length > 0) {
    push({
      key: "vibes",
      group: "Vibe",
      label: "Vibe tags",
      target: { type: "vibes" },
      newValue: vibes.value,
      oldValue: gym.vibe_tags,
      conflict: false,
    });
  }

  return {
    facts,
    factCount: facts.length,
    conflictCount: facts.filter((f) => f.conflict).length,
  };
}

/** Human-readable label for a fact's value (used in the queue diff). Robust to
 *  both the full proposed value (an array for set-style facts) and the current
 *  summary (a count number) stored as oldValue. */
export function describeValue(target: FactTarget, value: unknown): string {
  if (value === null || value === undefined) return "Unlisted";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    switch (target.type) {
      case "amenitySet":
      case "equipmentSet":
        return `${value} present`;
      case "plans":
        return `${value} plan(s)`;
      default:
        return String(value);
    }
  }
  switch (target.type) {
    case "amenitySet":
      return Array.isArray(value)
        ? value.map((k) => AMENITY_LABELS[k as AmenityKey] ?? k).join(", ")
        : String(value);
    case "equipmentSet":
      return Array.isArray(value)
        ? value.map((k) => EQUIPMENT_LABELS[k as EquipmentKey] ?? k).join(", ")
        : String(value);
    case "discounts":
    case "vibes":
    case "commitment":
      return Array.isArray(value) ? (value as string[]).join(", ") || "None" : String(value);
    case "plans":
      return Array.isArray(value)
        ? `${(value as PlanDraft[]).filter((p) => p.name?.trim()).length} plan(s)`
        : String(value);
    case "hours":
      return "schedule";
    default:
      return String(value);
  }
}
