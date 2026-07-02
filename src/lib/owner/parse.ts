/**
 * Convert an owner AnswerMap into a reviewable parsed-facts diff (the inverse of
 * prefill.ts). Each fact carries the proposed value, the current value, and a
 * machine-readable `target` so the publish handler can apply it at the `owner`
 * provenance tier.
 *
 * PROVENANCE GATE (never-fabricate): the answer map arrives prefilled from the
 * catalog, so a fact is emitted only when the field is VISIBLE and the answer
 * DIFFERS from the server-rebuilt baseline (buildPrefillAnswers(gym)) OR the
 * owner explicitly touched the field. Untouched prefill emits NOTHING — it must
 * never round-trip into an owner/0.95 fact. `ownerAction` records whether the
 * owner changed the value or confirmed the prefill as correct.
 */
import type { AnswerMap, FieldAnswer, PlanDraft } from "./answerTypes";
import { isAnswered } from "./answerTypes";
import { FORM_SECTIONS, visibleFields } from "./formConfig";
import { answerEquals, chipSetDiff, sanitizeHours } from "./diff";
import type { EnrichedGym, EquipmentKey, AmenityKey, GymSegment } from "@/lib/types/scout";
import { EQUIPMENT_LABELS, AMENITY_LABELS, normalizeInstagramHandle } from "@/lib/types/scout";
import { isOwnerPhotoUrl } from "./photoUrl";

export type FactTarget =
  | { type: "scalar"; column: string }
  | { type: "bool"; column: string }
  | { type: "discounts" }
  | { type: "commitment" }
  | { type: "amenitySet" }
  | { type: "amenityRemove" }
  | { type: "equipmentSet" }
  | { type: "equipmentRemove" }
  | { type: "equipmentAttr"; equipmentKey: string; attr: "quantity" | "max_weight_lbs" }
  | { type: "hours" }
  | { type: "plans" }
  | { type: "vibes" }
  | { type: "photos" }
  | { type: "parking" }
  | { type: "brands" }
  | { type: "earlyTermination" }
  | { type: "info"; field: string };

/** Grouped chip facts (discounts / commitment) carry the owner's full attested
 *  selection (`on`) plus the prefilled-then-deselected keys (`off`). Keys the
 *  owner never mentioned appear in NEITHER list and are never written. */
export interface OnOffValue {
  on: string[];
  off: string[];
}

export interface ParsedFact {
  key: string;
  group: string;
  label: string;
  target: FactTarget;
  newValue: unknown;
  oldValue: unknown;
  /** changes an existing non-null value (the reviewer should look closely) */
  conflict: boolean;
  /** "changed" = differs from the prefill baseline; "confirmed" = equal but
   *  explicitly touched (an owner attestation of the estimated value).
   *  Absent on facts parsed before this field existed (legacy submissions). */
  ownerAction?: "changed" | "confirmed";
}

export interface ParseResult {
  facts: ParsedFact[];
  factCount: number;
  conflictCount: number;
}

/** Server-rebuilt prefill baseline + the client's touched-field ids. */
export interface ParseContext {
  baseline: AnswerMap;
  touched: ReadonlySet<string>;
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
  a_instagram: { column: "instagram", kind: "text", label: "Instagram", group: "Identity" },
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

/** Grouped-discount chip key → gyms boolean column. Publish shares this map so
 *  the on/off keys land on exactly these columns (CLAUDE.md rule 5). */
export const DISCOUNT_COLUMNS: Record<string, string> = {
  student: "student_discount",
  military: "military_discount",
  senior: "senior_discount",
  corporate: "corporate_discount",
  family: "family_plans",
};

// Collected context we don't (yet) model as catalog columns. Emitted as `info`
// facts: persisted + shown to staff in the review queue, but never written to the
// catalog — so this owner input is no longer silently dropped at parse time.
const INFO_FIELDS: [string, string, string][] = [
  ["b_access", "Access model", "Identity"],
  ["a_secondary", "Secondary focus", "Identity"],
  ["g_min_age", "Minimum age", "Access"],
  ["g_youth", "Youth / kids programs", "Access"],
  ["e_reformer_count", "Reformers (count)", "Equipment"],
  ["e_bike_count", "Bikes (count)", "Equipment"],
  ["ct_phone", "Contact phone", "Contact"],
  ["h_diff", "Who it's for / what's different", "Owner notes"],
  ["j_voice", "More about the gym", "Owner notes"],
  ["i_photo_rights", "Photo rights affirmed", "Photos"],
];

const prettify = (v: string) => v.replace(/_/g, " ");

/** Human display string for an informational field's answer (any kind). */
function infoValue(a: FieldAnswer | undefined): string | null {
  if (!a) return null;
  switch (a.kind) {
    case "text":
      return a.value.trim() || null;
    case "num":
      return a.value === null ? null : String(a.value);
    case "choice":
      return a.value ? prettify(a.value) : null;
    case "chips":
      return a.value.length ? a.value.map(prettify).join(", ") : null;
    case "tri":
      return a.value === null ? null : a.value ? "Yes" : "No";
    default:
      return null;
  }
}

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

const chipsOf = (a: FieldAnswer | undefined): string[] => (a?.kind === "chips" ? a.value : []);

/** Build the set of equipment-field ids so we can collect equipment keys. */
const EQUIPMENT_FIELD_IDS = new Set(
  FORM_SECTIONS.flatMap((s) => s.fields).filter((f) => f.equipmentField).map((f) => f.id),
);

export function parseSubmission(answers: AnswerMap, gym: EnrichedGym, ctx: ParseContext): ParseResult {
  const { baseline, touched } = ctx;
  const facts: ParsedFact[] = [];
  const push = (f: Omit<ParsedFact, "conflict"> & { conflict?: boolean }) =>
    facts.push({ ...f, conflict: f.conflict ?? false });

  // Server-authoritative visibility: any field hidden by the active branches or
  // a showIf (same segment derivation as OwnerFormShell) emits NOTHING, even if
  // a tampered/stale client map still carries an answer for it.
  const answeredSegment =
    answers.a_segment?.kind === "choice" ? (answers.a_segment.value as GymSegment | null) : null;
  const segment = answeredSegment ?? gym.segment;
  const visibleIds = new Set<string>();
  for (const section of FORM_SECTIONS) {
    for (const f of visibleFields(section, segment, answers)) visibleIds.add(f.id);
  }
  visibleIds.add("i_photo_rights"); // virtual field owned by the photo uploader

  /** The differs-or-touched gate: "skip" = untouched prefill (no fact),
   *  "changed" = differs from baseline, "confirmed" = equal but touched. */
  const gate = (fieldId: string): "skip" | "changed" | "confirmed" => {
    if (!visibleIds.has(fieldId)) return "skip";
    if (answerEquals(answers[fieldId], baseline[fieldId])) {
      return touched.has(fieldId) ? "confirmed" : "skip";
    }
    return "changed";
  };

  // 1) Scalars
  for (const [fieldId, def] of Object.entries(SCALAR_MAP)) {
    const g = gate(fieldId);
    if (g === "skip") continue;
    const a = answers[fieldId];
    if (!isAnswered(a)) {
      // Owner CLEARED a prefilled text/num → an explicit "this is wrong" signal.
      if (g === "changed" && (def.kind === "text" || def.kind === "num") && isAnswered(baseline[fieldId])) {
        push({
          key: `scalar:${def.column}`,
          group: def.group,
          label: def.label,
          target: { type: "scalar", column: def.column },
          newValue: null,
          oldValue: gymVal(gym, def.column),
          conflict: true,
          ownerAction: "changed",
        });
      }
      continue;
    }
    let newValue = answerScalar(a);
    if (newValue === null) continue;
    let oldValue = gymVal(gym, def.column);
    // Instagram: store/compare a normalized handle so @handle vs URL vs handle
    // don't read as a conflict, and the stored value stays clean.
    if (def.column === "instagram") {
      newValue = normalizeInstagramHandle(String(newValue));
      oldValue = normalizeInstagramHandle(oldValue as string | null);
      if (newValue === null) continue;
    }
    const oldComparable = def.kind === "num" && oldValue !== null ? Number(oldValue) : oldValue;
    push({
      key: `scalar:${def.column}`,
      group: def.group,
      label: def.label,
      target: { type: "scalar", column: def.column },
      newValue,
      oldValue,
      conflict: oldComparable !== null && oldComparable !== newValue,
      ownerAction: g,
    });
  }

  // 2) tri-state booleans
  for (const [fieldId, column, label] of [
    ["m_app_required", "app_required_entry", "App required for entry"],
    ["m_waitlist", "waitlist", "Waitlist"],
  ] as const) {
    const g = gate(fieldId);
    if (g === "skip") continue;
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
        ownerAction: g,
      });
    }
  }

  // 3) Discounts — {on, off}: on = the owner's full attested selection, off =
  // prefilled-then-deselected keys ONLY. Unmentioned keys are never written.
  {
    const g = gate("m_discounts");
    if (g !== "skip") {
      const cur = chipsOf(answers["m_discounts"]).filter((k) => k in DISCOUNT_COLUMNS);
      const base = chipsOf(baseline["m_discounts"]).filter((k) => k in DISCOUNT_COLUMNS);
      const { removed } = chipSetDiff(cur, base);
      if (cur.length > 0 || removed.length > 0) {
        const current = Object.entries(DISCOUNT_COLUMNS)
          .filter(([, col]) => gymVal(gym, col) === true)
          .map(([key]) => key);
        push({
          key: "discounts",
          group: "Membership",
          label: "Discounts",
          target: { type: "discounts" },
          newValue: { on: cur, off: removed } satisfies OnOffValue,
          oldValue: current,
          conflict: removed.length > 0,
          ownerAction: g,
        });
      }
    }
  }

  // 4) Commitment terms — same {on, off} shape.
  {
    const g = gate("m_commitment");
    if (g !== "skip") {
      const cur = chipsOf(answers["m_commitment"]);
      const base = chipsOf(baseline["m_commitment"]);
      const { removed } = chipSetDiff(cur, base);
      if (cur.length > 0 || removed.length > 0) {
        push({
          key: "commitment",
          group: "Membership",
          label: "Commitment terms",
          target: { type: "commitment" },
          newValue: { on: cur, off: removed } satisfies OnOffValue,
          oldValue: {
            min_commitment_months: gym.min_commitment_months,
            no_contract_option: gym.no_contract_option,
          },
          conflict: removed.length > 0,
          ownerAction: g,
        });
      }
    }
  }

  // 5) Amenities — per-visible-field diff (d_amenities + g_womens +
  // g_accessibility) emitting up to three facts: added / confirmed / removed.
  // Removals (prefilled key actively deselected) are first-class facts now.
  {
    const added = new Set<string>();
    const removed = new Set<string>();
    const confirmed = new Set<string>();
    for (const fid of ["d_amenities", "g_accessibility"]) {
      if (!visibleIds.has(fid)) continue;
      const cur = chipsOf(answers[fid]);
      const base = chipsOf(baseline[fid]);
      const diff = chipSetDiff(cur, base);
      const isTouched = touched.has(fid);
      if (diff.added.length === 0 && diff.removed.length === 0 && !isTouched) continue;
      diff.added.forEach((k) => added.add(k));
      diff.removed.forEach((k) => removed.add(k));
      // Touching a chips field attests its whole final state — kept prefill
      // chips upgrade to owner as "confirmed" (staff-rejectable).
      if (isTouched) diff.kept.forEach((k) => confirmed.add(k));
    }
    // g_womens: a 0-or-1 chip set. Explicit "neither" empties it (removal when
    // the baseline had a women's key); an unanswered choice contributes nothing.
    if (visibleIds.has("g_womens")) {
      const a = answers["g_womens"];
      const b = baseline["g_womens"];
      const curV = a?.kind === "choice" ? a.value : null;
      const baseV = b?.kind === "choice" ? b.value : null;
      if (curV !== null) {
        const cur = curV === "womens_only" || curV === "womens_area" ? [curV] : [];
        const base = baseV ? [baseV] : [];
        const diff = chipSetDiff(cur, base);
        const isTouched = touched.has("g_womens");
        if (diff.added.length > 0 || diff.removed.length > 0 || isTouched) {
          diff.added.forEach((k) => added.add(k));
          diff.removed.forEach((k) => removed.add(k));
          if (isTouched) diff.kept.forEach((k) => confirmed.add(k));
        }
      }
    }
    // Presence wins if a key somehow lands on both sides.
    for (const k of added) removed.delete(k);
    for (const k of confirmed) removed.delete(k);
    const present = [...new Set(gym.amenities.filter((x) => x.present).map((x) => x.amenity_key))];
    if (added.size > 0) {
      push({
        key: "amenities",
        group: "Amenities",
        label: `Amenities added (${added.size})`,
        target: { type: "amenitySet" },
        newValue: [...added],
        oldValue: present,
        conflict: false,
        ownerAction: "changed",
      });
    }
    if (confirmed.size > 0) {
      push({
        key: "amenities-confirmed",
        group: "Amenities",
        label: `Amenities confirmed (${confirmed.size})`,
        target: { type: "amenitySet" },
        newValue: [...confirmed],
        oldValue: present,
        conflict: false,
        ownerAction: "confirmed",
      });
    }
    if (removed.size > 0) {
      push({
        key: "amenities-removed",
        group: "Amenities",
        label: `Amenities removed (${removed.size})`,
        target: { type: "amenityRemove" },
        newValue: [...removed],
        oldValue: present,
        conflict: true,
        ownerAction: "changed",
      });
    }
  }

  // 6) Equipment — union-level diff across the VISIBLE equipment fields
  // (row existence is per key across the gym, and the same key can appear in
  // several branch fields). Deselecting every chip in a field now emits
  // removals instead of silently dropping the field.
  {
    const curUnion = new Set<string>();
    const baseUnion = new Set<string>();
    const confirmed = new Set<string>();
    for (const fid of EQUIPMENT_FIELD_IDS) {
      if (!visibleIds.has(fid)) continue;
      const cur = chipsOf(answers[fid]);
      const base = chipsOf(baseline[fid]);
      cur.forEach((k) => curUnion.add(k));
      base.forEach((k) => baseUnion.add(k));
      if (touched.has(fid)) {
        chipSetDiff(cur, base).kept.forEach((k) => confirmed.add(k));
      }
    }
    const added = [...curUnion].filter((k) => !baseUnion.has(k));
    const removed = [...baseUnion].filter((k) => !curUnion.has(k));
    const confirmedList = [...confirmed].filter((k) => !added.includes(k));
    const present = [...new Set(gym.equipment.map((e) => e.equipment_key))];
    if (added.length > 0) {
      push({
        key: "equipment",
        group: "Equipment",
        label: `Equipment added (${added.length})`,
        target: { type: "equipmentSet" },
        newValue: added,
        oldValue: present,
        conflict: false,
        ownerAction: "changed",
      });
    }
    if (confirmedList.length > 0) {
      push({
        key: "equipment-confirmed",
        group: "Equipment",
        label: `Equipment confirmed (${confirmedList.length})`,
        target: { type: "equipmentSet" },
        newValue: confirmedList,
        oldValue: present,
        conflict: false,
        ownerAction: "confirmed",
      });
    }
    if (removed.length > 0) {
      push({
        key: "equipment-removed",
        group: "Equipment",
        label: `Equipment removed (${removed.length})`,
        target: { type: "equipmentRemove" },
        newValue: removed,
        oldValue: present,
        conflict: true,
        ownerAction: "changed",
      });
    }
  }

  // 7) Equipment attributes (counts / max weight). Strength and CrossFit
  // branches use different field ids for the same measurement — take whichever
  // is visible and answered, gated differs-or-touched like everything else.
  const pickNum = (ids: string[]): { fid: string; value: number } | null => {
    for (const fid of ids) {
      if (!visibleIds.has(fid)) continue;
      const a = answers[fid];
      if (a?.kind === "num" && a.value !== null) return { fid, value: a.value };
    }
    return null;
  };
  const squat = pickNum(["e_squat_count", "e_squat_count_c"]);
  if (squat) {
    const g = gate(squat.fid);
    if (g !== "skip") {
      // Resolve the REAL rack key: prefill showed squat_rack ?? power_rack
      // quantity, so the fact must land back on the row it came from — never
      // hard-code squat_rack onto a gym that only has a power_rack row.
      const hasSquat = gym.equipment.some((e) => e.equipment_key === "squat_rack");
      const hasPower = gym.equipment.some((e) => e.equipment_key === "power_rack");
      const equipmentKey = hasSquat ? "squat_rack" : hasPower ? "power_rack" : "squat_rack";
      // A zero count with no existing rack row is a no-op (and must never
      // fabricate a rack row) — only emit when there's a row to update or a
      // positive owner-typed count.
      if (hasSquat || hasPower || squat.value > 0) {
        push({
          key: `equip-attr:${equipmentKey}:quantity`,
          group: "Equipment",
          label: "Squat racks (count)",
          target: { type: "equipmentAttr", equipmentKey, attr: "quantity" },
          newValue: squat.value,
          oldValue: gym.equipment.find((e) => e.equipment_key === equipmentKey)?.quantity ?? null,
          conflict: false,
          ownerAction: g,
        });
      }
    }
  }
  const dbMax = pickNum(["e_db_max", "e_db_max_c"]);
  if (dbMax) {
    const g = gate(dbMax.fid);
    if (g !== "skip") {
      push({
        key: "equip-attr:dumbbells:max_weight_lbs",
        group: "Equipment",
        label: "Dumbbell max (lb)",
        target: { type: "equipmentAttr", equipmentKey: "dumbbells", attr: "max_weight_lbs" },
        newValue: dbMax.value,
        oldValue: gym.equipment.find((e) => e.equipment_key === "dumbbells")?.max_weight_lbs ?? null,
        conflict: false,
        ownerAction: g,
      });
    }
  }

  // 8) Hours — sanitize first (drop any day with a blank open OR close); no
  // fact when nothing complete remains or the sanitized grid equals baseline.
  {
    const g = gate("b_hours");
    const hours = answers["b_hours"];
    if (g !== "skip" && hours?.kind === "hours") {
      const sanitized = sanitizeHours(hours.value);
      if (sanitized) {
        push({
          key: "hours",
          group: "Hours",
          label: "Staffed hours",
          target: { type: "hours" },
          newValue: sanitized,
          oldValue: gym.hours,
          conflict: g === "changed" && gym.hours !== null,
          ownerAction: g,
        });
      }
    }
  }

  // 9) Membership plans — deep-diffed against the baseline drafts; an
  // untouched prefilled plan list emits nothing (no more silent lossy rewrite).
  {
    const g = gate("m_plans");
    const plans = answers["m_plans"];
    if (g !== "skip" && plans?.kind === "plans" && isAnswered(plans)) {
      push({
        key: "plans",
        group: "Membership",
        label: `Membership plans (${plans.value.filter((p) => p.name.trim()).length})`,
        target: { type: "plans" },
        newValue: plans.value,
        oldValue: gym.membership_plans?.length ?? 0,
        conflict: g === "changed" && (gym.membership_plans?.length ?? 0) > 0,
        ownerAction: g,
      });
    }
  }

  // 10) Vibe tags (soft — boost only). Wholesale replace; deselecting a
  // prefilled tag is a removal, so flag it for the reviewer.
  {
    const g = gate("h_vibes");
    if (g !== "skip") {
      const cur = chipsOf(answers["h_vibes"]);
      const base = chipsOf(baseline["h_vibes"]);
      const { removed } = chipSetDiff(cur, base);
      if (cur.length > 0 || removed.length > 0) {
        push({
          key: "vibes",
          group: "Vibe",
          label: "Vibe tags",
          target: { type: "vibes" },
          newValue: cur,
          oldValue: gym.vibe_tags,
          conflict: removed.length > 0,
          ownerAction: g,
        });
      }
    }
  }

  // 11) Photos (additive → gym gallery). Only OUR Supabase storage URLs are kept
  // (a tampered/off-domain url in the client answer map is dropped), and photos
  // publish only when the owner affirmed image rights — otherwise they're held.
  const photos = answers["i_photos"];
  if (visibleIds.has("i_photos") && photos?.kind === "photo" && photos.value.length > 0) {
    const valid = photos.value.filter((p) => isOwnerPhotoUrl(p.url));
    const rightsA = answers["i_photo_rights"];
    const rightsOk = rightsA?.kind === "tri" && rightsA.value === true;
    if (valid.length > 0 && rightsOk) {
      push({
        key: "photos",
        group: "Photos",
        label: `Photos (${valid.length})`,
        target: { type: "photos" },
        newValue: valid,
        oldValue: null,
        conflict: false,
        ownerAction: "changed",
      });
    } else if (valid.length > 0) {
      // Uploaded but rights not affirmed → do NOT publish; flag for staff follow-up.
      push({
        key: "photos-held",
        group: "Photos",
        label: `Photos held (${valid.length})`,
        target: { type: "info", field: "i_photos" },
        newValue: `${valid.length} photo(s) uploaded but image rights not affirmed — not published`,
        oldValue: null,
        conflict: true,
        ownerAction: "changed",
      });
    }
  }

  // 12) Parking (primary spot) — kind/access/fee → gym_parking row
  {
    const gates = (["f_kind", "f_access", "f_fee"] as const).map((fid) => gate(fid));
    if (gates.some((g) => g !== "skip")) {
      const fKind = visibleIds.has("f_kind") ? answers["f_kind"] : undefined;
      const fAccess = visibleIds.has("f_access") ? answers["f_access"] : undefined;
      const fFee = visibleIds.has("f_fee") ? answers["f_fee"] : undefined;
      if (
        (fKind?.kind === "choice" && fKind.value) ||
        (fAccess?.kind === "choice" && fAccess.value) ||
        (fFee?.kind === "text" && fFee.value.trim())
      ) {
        const g = gates.includes("changed") ? ("changed" as const) : ("confirmed" as const);
        const existing = gym.parking.find((p) => p.is_primary) ?? gym.parking[0];
        push({
          key: "parking",
          group: "Parking",
          label: "Parking",
          target: { type: "parking" },
          newValue: {
            kind: fKind?.kind === "choice" ? fKind.value : null,
            access: fAccess?.kind === "choice" ? fAccess.value : null,
            fee_detail: fFee?.kind === "text" && fFee.value.trim() ? fFee.value.trim() : null,
          },
          oldValue: existing ? { kind: existing.kind, access: existing.access } : null,
          conflict: g === "changed" && !!existing,
          ownerAction: g,
        });
      }
    }
  }

  // 13) Equipment brands (matched chips + free-text other) → noted on equipment
  {
    const gates = (["e_brands", "e_brands_other"] as const).map((fid) => gate(fid));
    if (gates.some((g) => g !== "skip")) {
      const brandChips = visibleIds.has("e_brands") ? answers["e_brands"] : undefined;
      const brandOther = visibleIds.has("e_brands_other") ? answers["e_brands_other"] : undefined;
      const brandList: string[] = [];
      if (brandChips?.kind === "chips") brandList.push(...brandChips.value);
      if (brandOther?.kind === "text" && brandOther.value.trim()) brandList.push(brandOther.value.trim());
      if (brandList.length > 0) {
        push({
          key: "brands",
          group: "Equipment",
          label: "Equipment brands",
          target: { type: "brands" },
          newValue: brandList,
          oldValue: [...new Set(gym.equipment.map((e) => e.brand).filter(Boolean))].length,
          conflict: false,
          ownerAction: gates.includes("changed") ? "changed" : "confirmed",
        });
      }
    }
  }

  // 14) Early-termination terms → early_termination jsonb
  {
    const gates = (["m_early_term", "m_early_term_note"] as const).map((fid) => gate(fid));
    if (gates.some((g) => g !== "skip")) {
      const earlyTerm = visibleIds.has("m_early_term") ? answers["m_early_term"] : undefined;
      const earlyNote = visibleIds.has("m_early_term_note") ? answers["m_early_term_note"] : undefined;
      if (
        (earlyTerm?.kind === "choice" && earlyTerm.value) ||
        (earlyNote?.kind === "text" && earlyNote.value.trim())
      ) {
        const g = gates.includes("changed") ? ("changed" as const) : ("confirmed" as const);
        push({
          key: "earlyTermination",
          group: "Membership",
          label: "Early termination",
          target: { type: "earlyTermination" },
          newValue: {
            type: earlyTerm?.kind === "choice" ? earlyTerm.value : null,
            note: earlyNote?.kind === "text" && earlyNote.value.trim() ? earlyNote.value.trim() : null,
          },
          oldValue: gym.early_termination ?? null,
          conflict: g === "changed" && !!gym.early_termination,
          ownerAction: g,
        });
      }
    }
  }

  // 15) Informational fields — collected context not modeled as catalog columns
  // (positioning, demographics, counts, contact phone). Surfaced to staff in the
  // queue and persisted, but never written to the catalog (a human reads them).
  for (const [fieldId, label, group] of INFO_FIELDS) {
    const g = gate(fieldId);
    if (g === "skip") continue;
    const a = answers[fieldId];
    if (!isAnswered(a)) continue;
    const display = infoValue(a);
    if (!display) continue;
    push({
      key: `info:${fieldId}`,
      group,
      label,
      target: { type: "info", field: fieldId },
      newValue: display,
      oldValue: null,
      conflict: false,
      ownerAction: g,
    });
  }

  return {
    facts,
    factCount: facts.length,
    conflictCount: facts.filter((f) => f.conflict).length,
  };
}

/** True when a value is the grouped {on, off} shape (discounts/commitment). */
export function isOnOffValue(v: unknown): v is OnOffValue {
  return (
    !!v &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Array.isArray((v as OnOffValue).on) &&
    Array.isArray((v as OnOffValue).off)
  );
}

/** Human-readable label for a fact's value (used in the queue diff). Handles
 *  list-shaped values (amenity/equipment/vibe/discount keys — both new and old
 *  values), the {on, off} grouped shape, and the legacy count-number form still
 *  produced for some summaries (e.g. the `brands` oldValue). */
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
      case "brands":
        return `${value} on file`;
      default:
        return String(value);
    }
  }
  switch (target.type) {
    case "amenitySet":
    case "amenityRemove":
      return Array.isArray(value)
        ? value.map((k) => AMENITY_LABELS[k as AmenityKey] ?? k).join(", ")
        : String(value);
    case "equipmentSet":
    case "equipmentRemove":
      return Array.isArray(value)
        ? value.map((k) => EQUIPMENT_LABELS[k as EquipmentKey] ?? k).join(", ")
        : String(value);
    case "discounts":
    case "commitment": {
      if (Array.isArray(value)) return (value as string[]).map(prettify).join(", ") || "None"; // legacy
      if (isOnOffValue(value)) {
        const on = value.on.map(prettify).join(", ");
        const off = value.off.map(prettify).join(", ");
        return `${on || "None"}${off ? ` — removes: ${off}` : ""}`;
      }
      if (target.type === "commitment" && typeof value === "object") {
        // commitment oldValue: { min_commitment_months, no_contract_option }
        const v = value as { min_commitment_months?: number | null; no_contract_option?: boolean | null };
        const parts: string[] = [];
        if (v.min_commitment_months != null) parts.push(`${v.min_commitment_months}-mo min`);
        if (v.no_contract_option === true) parts.push("month-to-month");
        if (v.no_contract_option === false) parts.push("contract only");
        return parts.join(" · ") || "Unlisted";
      }
      return String(value);
    }
    case "vibes":
      return Array.isArray(value) ? (value as string[]).join(", ") || "None" : String(value);
    case "plans":
      return Array.isArray(value)
        ? `${(value as PlanDraft[]).filter((p) => p.name?.trim()).length} plan(s)`
        : String(value);
    case "hours":
      return "schedule";
    case "photos":
      return Array.isArray(value) ? `${value.length} photo(s)` : String(value);
    case "brands":
      return Array.isArray(value) ? (value as string[]).join(", ") || "None" : String(value);
    case "parking": {
      const p = value as { kind?: string | null; access?: string | null; fee_detail?: string | null };
      return [p.kind, p.access, p.fee_detail].filter(Boolean).join(" · ") || "—";
    }
    case "earlyTermination": {
      const e = value as { type?: string | null; note?: string | null };
      return [e.type, e.note].filter(Boolean).join(" · ") || "—";
    }
    case "info":
      return typeof value === "string" ? value : String(value);
    default:
      return String(value);
  }
}
