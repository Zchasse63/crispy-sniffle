/**
 * Build the initial AnswerMap from a real gym (the "we already filled it in,
 * just confirm" hook). NEVER fabricates: only facts present in the DB populate
 * an answer; everything else stays empty/null ("unlisted").
 */
import type { AnswerMap, FieldAnswer } from "./answerTypes";
import { BRAND_OPTIONS, FORM_SECTIONS, type FieldDef } from "./formConfig";
import type { EnrichedGym, EquipmentKey } from "@/lib/types/scout";

/** A blank answer matching a field's shape — the start-over / unanswered state. */
export function emptyAnswer(field: FieldDef): FieldAnswer {
  switch (field.type) {
    case "chip-multi":
      return { kind: "chips", value: [] };
    case "chip-single":
      return { kind: "choice", value: null };
    case "tri-state":
      return { kind: "tri", value: null };
    case "stepper":
    case "currency":
      return { kind: "num", value: null };
    case "text":
    case "text-voice":
      return { kind: "text", value: "" };
    case "hours-grid":
      return { kind: "hours", value: null };
    case "membership-plans":
      return { kind: "plans", value: [] };
    case "photo-stub":
      return { kind: "photo", value: [] };
  }
}

/** Every field blank — used for "start over". */
export function emptyAnswers(): AnswerMap {
  const out: AnswerMap = {};
  for (const section of FORM_SECTIONS) {
    for (const field of section.fields) out[field.id] = emptyAnswer(field);
  }
  return out;
}

export function buildPrefillAnswers(gym: EnrichedGym): AnswerMap {
  const out = emptyAnswers();

  const presentEquip = new Set<EquipmentKey>(gym.equipment.map((e) => e.equipment_key));
  const presentAmenities = new Set(gym.amenities.filter((a) => a.present).map((a) => a.amenity_key));
  const equipByKey = new Map(gym.equipment.map((e) => [e.equipment_key, e]));

  const setText = (id: string, v: string | null) => {
    if (v != null && v !== "") out[id] = { kind: "text", value: v };
  };
  const setNum = (id: string, v: number | null) => {
    if (v != null) out[id] = { kind: "num", value: Number(v) };
  };
  const setChoice = (id: string, v: string | null) => {
    if (v != null) out[id] = { kind: "choice", value: v };
  };

  // A — identity
  setText("a_name", gym.name);
  setText("a_address", gym.address);
  setText("a_phone", gym.phone);
  setText("a_website", gym.website);
  setText("a_instagram", gym.instagram);
  setChoice("a_segment", gym.segment);

  // B — access model + staffed hours. We do NOT prefill b_access: the DB
  // open_24h flag can't distinguish 24-hour keyfob ACCESS from staffed-24h, so
  // guessing one would assert a possibly-wrong value (never-fabricate). The
  // field's hint guides the owner to pick the right one.
  // Staffed-hours grid never carries the open_24h flag (the grid owns day windows).
  if (gym.hours) {
    const { open_24h: _o, ...dayHours } = gym.hours;
    if (Object.keys(dayHours).length) out.b_hours = { kind: "hours", value: dayHours };
  }

  // C — pricing & passes
  setChoice("c_dropin", gym.drop_in_policy);
  setChoice("c_guest_model", gym.guest_policy_model);
  setText("c_members_guest_note", gym.members_guest_note);
  setNum("c_daypass", gym.day_pass_price);
  setNum("c_weekpass", gym.week_pass_price);
  setNum("c_single_class", gym.single_class_price);
  setNum("c_monthly", gym.monthly_from);
  setText("c_intro_offer", gym.intro_offer);
  // Strict inverse of parse's c_notes → pricing_notes. Concatenating
  // monthly_note/drop_in_note here made an untouched submit round-trip the
  // combined string back INTO pricing_notes (growing it on every re-invite).
  setText("c_notes", gym.pricing_notes);

  // M — membership & fees
  setNum("m_enrollment_fee", gym.enrollment_fee);
  setNum("m_annual_fee", gym.annual_fee);
  setText("m_annual_fee_label", gym.annual_fee_label);
  setNum("m_cancel_days", gym.cancellation_notice_days);
  setText("m_freeze", gym.freeze_policy);
  // Commitment terms (infer from DB so the early-termination prefill, which is
  // gated behind offersContract, is actually reachable for the owner to confirm).
  const terms: string[] = [];
  if (gym.no_contract_option) terms.push("month_to_month");
  if (gym.min_commitment_months === 3) terms.push("3_month");
  else if (gym.min_commitment_months === 6) terms.push("6_month");
  else if (gym.min_commitment_months === 12) terms.push("12_month");
  if (terms.length) out.m_commitment = { kind: "chips", value: terms };
  if (gym.early_termination?.type) setChoice("m_early_term", gym.early_termination.type);
  setText("m_early_term_note", gym.early_termination?.note ?? null);
  if (gym.app_required_entry != null) out.m_app_required = { kind: "tri", value: gym.app_required_entry };
  if (gym.waitlist != null) out.m_waitlist = { kind: "tri", value: gym.waitlist };
  const discounts: string[] = [];
  if (gym.student_discount) discounts.push("student");
  if (gym.military_discount) discounts.push("military");
  if (gym.senior_discount) discounts.push("senior");
  if (gym.corporate_discount) discounts.push("corporate");
  if (gym.family_plans) discounts.push("family");
  if (discounts.length) out.m_discounts = { kind: "chips", value: discounts };
  if (gym.membership_plans && gym.membership_plans.length) {
    out.m_plans = {
      kind: "plans",
      value: gym.membership_plans.map((p) => ({
        name: p.name ?? "",
        usageType: p.usage?.type ?? null,
        usageCount: p.usage?.count ?? null,
        prices: (["month_to_month", "6_month", "12_month"] as const).map((term) => ({
          term,
          monthly: p.prices?.find((pr) => pr.term === term)?.monthly ?? null,
        })),
        // Carry the FULL original plan so publish restores what the 3-column
        // UI doesn't edit (scope/hours/includes/notes/paid_total/extra terms)
        // instead of destroying it on round trip.
        carry: p,
      })),
    };
  }

  // D — amenities (present only; absence stays unlisted). Intersect with the
  // section's actual chip options so the answer never holds keys D doesn't
  // render (day_pass/parking/open_24h live in pricing/parking/hours).
  const dField = FORM_SECTIONS.flatMap((s) => s.fields).find((f) => f.id === "d_amenities");
  const dKeys = new Set(dField?.options?.map((o) => o.key) ?? []);
  out.d_amenities = {
    kind: "chips",
    value: gym.amenities.filter((a) => a.present && dKeys.has(a.amenity_key)).map((a) => a.amenity_key),
  };

  // G — women's-only (only set when known; never fabricate "neither")
  if (presentAmenities.has("womens_only")) setChoice("g_womens", "womens_only");
  else if (presentAmenities.has("womens_area")) setChoice("g_womens", "womens_area");
  const accessPresent = (["wheelchair_accessible", "accessible_restrooms"] as const).filter((k) =>
    presentAmenities.has(k),
  );
  if (accessPresent.length) out.g_accessibility = { kind: "chips", value: [...accessPresent] };

  // E — equipment: each chip-multi equipment field prefills with its present keys
  for (const section of FORM_SECTIONS) {
    for (const field of section.fields) {
      if (field.equipmentField && field.options) {
        const present = field.options.map((o) => o.key as EquipmentKey).filter((k) => presentEquip.has(k));
        if (present.length) out[field.id] = { kind: "chips", value: present };
      }
    }
  }
  // E steppers from equipment quantities / weights
  const squat = equipByKey.get("squat_rack") ?? equipByKey.get("power_rack");
  if (squat?.quantity != null) out.e_squat_count = { kind: "num", value: Number(squat.quantity) };
  const db = equipByKey.get("dumbbells");
  if (db?.max_weight_lbs != null) out.e_db_max = { kind: "num", value: Number(db.max_weight_lbs) };
  // brands seen across equipment → match to the brand chips; rest → "other" note
  const brandStrings = Array.from(new Set(gym.equipment.map((e) => e.brand).filter(Boolean) as string[]));
  if (brandStrings.length) {
    const matched: string[] = [];
    const others: string[] = [];
    for (const b of brandStrings) {
      const hit = BRAND_OPTIONS.find((o) => o.label.toLowerCase() === b.toLowerCase());
      if (hit) matched.push(hit.key);
      else others.push(b);
    }
    if (matched.length) out.e_brands = { kind: "chips", value: matched };
    if (others.length) setText("e_brands_other", others.join(", "));
  }

  // F — parking (primary record)
  const primary = gym.parking.find((p) => p.is_primary) ?? gym.parking[0];
  if (primary) {
    setChoice("f_kind", primary.kind);
    setChoice("f_access", primary.access);
    setText("f_fee", primary.fee_detail);
  }

  // H — vibe
  if (gym.vibe_tags.length) out.h_vibes = { kind: "chips", value: [...gym.vibe_tags] };

  return out;
}
