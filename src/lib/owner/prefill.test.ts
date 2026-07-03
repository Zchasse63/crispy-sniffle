import { describe, it, expect } from "vitest";
import { buildPrefillAnswers, emptyAnswer, emptyAnswers } from "./prefill";
import { FORM_SECTIONS } from "./formConfig";
import { makeGym, amenity, equipment } from "@/lib/testFactory";
import type { GymParkingRecord, MembershipPlan } from "@/lib/types/scout";

function parking(over: Partial<GymParkingRecord> = {}): GymParkingRecord {
  return {
    id: "pk-1",
    gym_id: "gym-1",
    kind: "onsite_lot",
    name: null,
    distance_m: null,
    access: "free",
    fee_detail: null,
    capacity: null,
    lat: null,
    lng: null,
    is_primary: false,
    source: "scraped",
    confidence: 0.85,
    detail: null,
    ...over,
  };
}

describe("emptyAnswers / emptyAnswer", () => {
  it("produces a blank answer for every field in FORM_SECTIONS", () => {
    const out = emptyAnswers();
    for (const section of FORM_SECTIONS) {
      for (const field of section.fields) {
        expect(out[field.id], `missing blank for ${field.id}`).toBeDefined();
        expect(out[field.id]).toEqual(emptyAnswer(field));
      }
    }
  });

  it("blank shapes are truly unanswered (never fabricated defaults)", () => {
    const out = emptyAnswers();
    expect(out.d_amenities).toEqual({ kind: "chips", value: [] });
    expect(out.a_segment).toEqual({ kind: "choice", value: null });
    expect(out.g_youth).toEqual({ kind: "tri", value: null });
    expect(out.c_daypass).toEqual({ kind: "num", value: null });
    expect(out.a_name).toEqual({ kind: "text", value: "" });
    expect(out.b_hours).toEqual({ kind: "hours", value: null });
    expect(out.m_plans).toEqual({ kind: "plans", value: [] });
    expect(out.i_photos).toEqual({ kind: "photo", value: [] });
  });
});

describe("buildPrefillAnswers — identity (A)", () => {
  it("prefills known identity fields and leaves unknown ones blank", () => {
    const gym = makeGym({
      name: "Iron Works",
      address: "500 Bay St",
      phone: "813-555-0100",
      website: null,
      instagram: "@ironworks",
      segment: "strength",
    });
    const out = buildPrefillAnswers(gym);
    expect(out.a_name).toEqual({ kind: "text", value: "Iron Works" });
    expect(out.a_address).toEqual({ kind: "text", value: "500 Bay St" });
    expect(out.a_phone).toEqual({ kind: "text", value: "813-555-0100" });
    expect(out.a_website).toEqual({ kind: "text", value: "" }); // null stays blank
    expect(out.a_instagram).toEqual({ kind: "text", value: "@ironworks" });
    expect(out.a_segment).toEqual({ kind: "choice", value: "strength" });
  });

  it("empty-string DB values stay blank (no phantom answers)", () => {
    const out = buildPrefillAnswers(makeGym({ address: "" }));
    expect(out.a_address).toEqual({ kind: "text", value: "" });
  });
});

describe("buildPrefillAnswers — hours & access (B)", () => {
  it("NEVER prefills b_access, even for an open_24h gym (ambiguous flag)", () => {
    const out = buildPrefillAnswers(
      makeGym({ open_24h: true, hours: { open_24h: true, mon: ["06:00", "22:00"] } }),
    );
    expect(out.b_access).toEqual({ kind: "choice", value: null });
  });

  it("strips open_24h from the staffed-hours grid value", () => {
    const out = buildPrefillAnswers(
      makeGym({ hours: { open_24h: true, mon: ["06:00", "22:00"], sat: ["08:00", "14:00"] } }),
    );
    expect(out.b_hours).toEqual({
      kind: "hours",
      value: { mon: ["06:00", "22:00"], sat: ["08:00", "14:00"] },
    });
  });

  it("hours with ONLY the open_24h flag leave b_hours unanswered", () => {
    const out = buildPrefillAnswers(makeGym({ hours: { open_24h: true } }));
    expect(out.b_hours).toEqual({ kind: "hours", value: null });
  });

  it("null hours leave b_hours unanswered", () => {
    const out = buildPrefillAnswers(makeGym({ hours: null }));
    expect(out.b_hours).toEqual({ kind: "hours", value: null });
  });
});

describe("buildPrefillAnswers — pricing (C)", () => {
  it("c_notes prefills from pricing_notes ONLY — never a monthly/drop-in-note concat", () => {
    const gym = makeGym({
      pricing_notes: "Peak vs off-peak rates apply.",
      monthly_note: "Promo: $1 enrollment in June",
      drop_in_note: "Drop-ins only before 3pm",
    });
    const out = buildPrefillAnswers(gym);
    expect(out.c_notes).toEqual({ kind: "text", value: "Peak vs off-peak rates apply." });
  });

  it("c_notes stays blank when pricing_notes is null, even if the other notes exist", () => {
    const gym = makeGym({
      pricing_notes: null,
      monthly_note: "Promo month",
      drop_in_note: "Ask at desk",
    });
    const out = buildPrefillAnswers(gym);
    expect(out.c_notes).toEqual({ kind: "text", value: "" });
  });

  it("prefills known prices and leaves unknown ones null", () => {
    const gym = makeGym({
      day_pass_price: 15,
      week_pass_price: null,
      single_class_price: 22,
      monthly_from: 39.99,
      intro_offer: "First week free",
      drop_in_policy: "walk_in",
      guest_policy_model: "member_invite_only",
      members_guest_note: "Free with a member",
    });
    const out = buildPrefillAnswers(gym);
    expect(out.c_daypass).toEqual({ kind: "num", value: 15 });
    expect(out.c_weekpass).toEqual({ kind: "num", value: null });
    expect(out.c_single_class).toEqual({ kind: "num", value: 22 });
    expect(out.c_monthly).toEqual({ kind: "num", value: 39.99 });
    expect(out.c_intro_offer).toEqual({ kind: "text", value: "First week free" });
    expect(out.c_dropin).toEqual({ kind: "choice", value: "walk_in" });
    expect(out.c_guest_model).toEqual({ kind: "choice", value: "member_invite_only" });
    expect(out.c_members_guest_note).toEqual({ kind: "text", value: "Free with a member" });
  });

  it("coerces PostgREST numeric wire-strings to real numbers", () => {
    const gym = makeGym({ day_pass_price: "15" as unknown as number });
    const out = buildPrefillAnswers(gym);
    expect(out.c_daypass).toEqual({ kind: "num", value: 15 });
  });
});

describe("buildPrefillAnswers — commitment chips (M)", () => {
  it("no_contract_option true seeds month_to_month", () => {
    const out = buildPrefillAnswers(makeGym({ no_contract_option: true }));
    expect(out.m_commitment).toEqual({ kind: "chips", value: ["month_to_month"] });
  });

  it("no_contract_option FALSE does not seed a chip (false ≠ month-to-month offered)", () => {
    const out = buildPrefillAnswers(makeGym({ no_contract_option: false }));
    expect(out.m_commitment).toEqual({ kind: "chips", value: [] });
  });

  it("unknown (null) commitment columns leave m_commitment empty — not fabricated", () => {
    const out = buildPrefillAnswers(makeGym({ no_contract_option: null, min_commitment_months: null }));
    expect(out.m_commitment).toEqual({ kind: "chips", value: [] });
  });

  it.each([
    [3, "3_month"],
    [6, "6_month"],
    [12, "12_month"],
  ] as const)("min_commitment_months %i seeds the %s chip", (months, chip) => {
    const out = buildPrefillAnswers(makeGym({ min_commitment_months: months }));
    expect(out.m_commitment).toEqual({ kind: "chips", value: [chip] });
  });

  it("a non-standard commitment length seeds nothing rather than guessing", () => {
    const out = buildPrefillAnswers(makeGym({ min_commitment_months: 24 }));
    expect(out.m_commitment).toEqual({ kind: "chips", value: [] });
  });

  it("month-to-month + 12-month combine", () => {
    const out = buildPrefillAnswers(makeGym({ no_contract_option: true, min_commitment_months: 12 }));
    expect(out.m_commitment).toEqual({ kind: "chips", value: ["month_to_month", "12_month"] });
  });
});

describe("buildPrefillAnswers — discount chips (M)", () => {
  it("seeds chips ONLY from true columns; false and null are both absent", () => {
    const gym = makeGym({
      student_discount: true,
      military_discount: false, // known-no → no chip (chips can't express no)
      senior_discount: null, // unknown → no chip
      corporate_discount: true,
      family_plans: null,
    });
    const out = buildPrefillAnswers(gym);
    expect(out.m_discounts).toEqual({ kind: "chips", value: ["student", "corporate"] });
  });

  it("all-unknown discount columns leave m_discounts empty", () => {
    const out = buildPrefillAnswers(makeGym());
    expect(out.m_discounts).toEqual({ kind: "chips", value: [] });
  });

  it("family_plans maps to the 'family' chip key", () => {
    const out = buildPrefillAnswers(makeGym({ family_plans: true }));
    expect(out.m_discounts).toEqual({ kind: "chips", value: ["family"] });
  });
});

describe("buildPrefillAnswers — fees, tri-states, early termination (M)", () => {
  it("prefills fee fields when known", () => {
    const gym = makeGym({
      enrollment_fee: 49,
      annual_fee: 59,
      annual_fee_label: "Club enhancement fee",
      cancellation_notice_days: 30,
      freeze_policy: "Up to 3 months, $10/mo",
    });
    const out = buildPrefillAnswers(gym);
    expect(out.m_enrollment_fee).toEqual({ kind: "num", value: 49 });
    expect(out.m_annual_fee).toEqual({ kind: "num", value: 59 });
    expect(out.m_annual_fee_label).toEqual({ kind: "text", value: "Club enhancement fee" });
    expect(out.m_cancel_days).toEqual({ kind: "num", value: 30 });
    expect(out.m_freeze).toEqual({ kind: "text", value: "Up to 3 months, $10/mo" });
  });

  it("tri-states carry explicit true AND explicit false, but null stays unanswered", () => {
    const t = buildPrefillAnswers(makeGym({ app_required_entry: true, waitlist: false }));
    expect(t.m_app_required).toEqual({ kind: "tri", value: true });
    expect(t.m_waitlist).toEqual({ kind: "tri", value: false });
    const u = buildPrefillAnswers(makeGym({ app_required_entry: null, waitlist: null }));
    expect(u.m_app_required).toEqual({ kind: "tri", value: null });
    expect(u.m_waitlist).toEqual({ kind: "tri", value: null });
  });

  it("early_termination prefills type + note; absent stays blank", () => {
    const gym = makeGym({ early_termination: { type: "flat_fee", amount: 99, note: "waived after 6 mo" } });
    const out = buildPrefillAnswers(gym);
    expect(out.m_early_term).toEqual({ kind: "choice", value: "flat_fee" });
    expect(out.m_early_term_note).toEqual({ kind: "text", value: "waived after 6 mo" });
    const none = buildPrefillAnswers(makeGym({ early_termination: null }));
    expect(none.m_early_term).toEqual({ kind: "choice", value: null });
    expect(none.m_early_term_note).toEqual({ kind: "text", value: "" });
  });
});

describe("buildPrefillAnswers — membership plans carry the FULL original plan", () => {
  const richPlan: MembershipPlan = {
    name: "Signature",
    usage: { type: "visits_per_month", count: 8 },
    scope: "multi_club",
    hours: "off_peak",
    includes: ["towel service", "guest passes"],
    prices: [
      { term: "month_to_month", monthly: 89 },
      { term: "3_month", monthly: 79 }, // term the 3-column UI doesn't edit
      { term: "12_month", monthly: 59, paid_total: 708 },
      { term: "paid_in_full", monthly: null, paid_total: 599 },
    ],
    notes: "Founding-member rate",
  };

  it("maps name/usage and the three fixed price columns", () => {
    const out = buildPrefillAnswers(makeGym({ membership_plans: [richPlan] }));
    expect(out.m_plans.kind).toBe("plans");
    if (out.m_plans.kind !== "plans") return;
    const [draft] = out.m_plans.value;
    expect(draft.name).toBe("Signature");
    expect(draft.usageType).toBe("visits_per_month");
    expect(draft.usageCount).toBe(8);
    expect(draft.prices).toEqual([
      { term: "month_to_month", monthly: 89 },
      { term: "6_month", monthly: null }, // not offered → null, not invented
      { term: "12_month", monthly: 59 },
    ]);
  });

  it("carry holds the untouched original plan incl. paid_total, extra terms, scope/hours/includes/notes", () => {
    const out = buildPrefillAnswers(makeGym({ membership_plans: [richPlan] }));
    if (out.m_plans.kind !== "plans") throw new Error("expected plans answer");
    const [draft] = out.m_plans.value;
    expect(draft.carry).toBe(richPlan); // the very same object, not a lossy copy
    expect(draft.carry?.prices).toContainEqual({ term: "paid_in_full", monthly: null, paid_total: 599 });
    expect(draft.carry?.prices).toContainEqual({ term: "3_month", monthly: 79 });
    expect(draft.carry?.scope).toBe("multi_club");
    expect(draft.carry?.hours).toBe("off_peak");
    expect(draft.carry?.includes).toEqual(["towel service", "guest passes"]);
    expect(draft.carry?.notes).toBe("Founding-member rate");
  });

  it("plan with null usage / missing name maps to safe blanks", () => {
    const bare: MembershipPlan = { name: undefined as unknown as string, usage: null, prices: [] };
    const out = buildPrefillAnswers(makeGym({ membership_plans: [bare] }));
    if (out.m_plans.kind !== "plans") throw new Error("expected plans answer");
    const [draft] = out.m_plans.value;
    expect(draft.name).toBe("");
    expect(draft.usageType).toBeNull();
    expect(draft.usageCount).toBeNull();
    expect(draft.prices.every((p) => p.monthly === null)).toBe(true);
  });

  it("null / empty membership_plans leave m_plans empty", () => {
    expect(buildPrefillAnswers(makeGym({ membership_plans: null })).m_plans).toEqual({
      kind: "plans",
      value: [],
    });
    expect(buildPrefillAnswers(makeGym({ membership_plans: [] })).m_plans).toEqual({
      kind: "plans",
      value: [],
    });
  });
});

describe("buildPrefillAnswers — amenities (D) & inclusivity (G)", () => {
  it("only PRESENT amenities that section D actually renders are selected", () => {
    const gym = makeGym({
      amenities: [
        amenity("sauna"),
        amenity("pool", { present: false }), // known-absent → not a selection
        amenity("day_pass"), // D-excluded (lives in pricing)
        amenity("open_24h"), // D-excluded (lives in hours)
        amenity("parking"), // D-excluded (lives in F)
        amenity("womens_only"), // D-excluded (lives in G)
        amenity("wheelchair_accessible"), // D-excluded (lives in G)
      ],
    });
    const out = buildPrefillAnswers(gym);
    expect(out.d_amenities).toEqual({ kind: "chips", value: ["sauna"] });
  });

  it("estimated-tier amenities ARE prefilled as selections without upgrading the record's tier", () => {
    const est = amenity("cold_plunge", { source: "estimated", confidence: 0.6 });
    const gym = makeGym({ amenities: [est] });
    const out = buildPrefillAnswers(gym);
    if (out.d_amenities.kind !== "chips") throw new Error("expected chips");
    expect(out.d_amenities.value).toContain("cold_plunge");
    // prefill must not launder the tier: the source record is untouched
    expect(gym.amenities[0].source).toBe("estimated");
    expect(gym.amenities[0].confidence).toBe(0.6);
  });

  it("g_womens maps womens_only over womens_area, and is NEVER fabricated as 'neither'", () => {
    const only = buildPrefillAnswers(
      makeGym({ amenities: [amenity("womens_only"), amenity("womens_area")] }),
    );
    expect(only.g_womens).toEqual({ kind: "choice", value: "womens_only" });

    const area = buildPrefillAnswers(makeGym({ amenities: [amenity("womens_area")] }));
    expect(area.g_womens).toEqual({ kind: "choice", value: "womens_area" });

    const unknown = buildPrefillAnswers(makeGym({ amenities: [] }));
    expect(unknown.g_womens).toEqual({ kind: "choice", value: null });
  });

  it("a present:false womens_only record does not select g_womens", () => {
    const out = buildPrefillAnswers(makeGym({ amenities: [amenity("womens_only", { present: false })] }));
    expect(out.g_womens).toEqual({ kind: "choice", value: null });
  });

  it("g_accessibility seeds only from present accessibility amenities", () => {
    const both = buildPrefillAnswers(
      makeGym({ amenities: [amenity("wheelchair_accessible"), amenity("accessible_restrooms")] }),
    );
    expect(both.g_accessibility).toEqual({
      kind: "chips",
      value: ["wheelchair_accessible", "accessible_restrooms"],
    });
    const none = buildPrefillAnswers(makeGym());
    expect(none.g_accessibility).toEqual({ kind: "chips", value: [] });
  });
});

describe("buildPrefillAnswers — equipment (E)", () => {
  it("prefills each equipment chip field with the gym's present keys", () => {
    const gym = makeGym({
      equipment: [equipment("dumbbells"), equipment("squat_rack"), equipment("reformer")],
    });
    const out = buildPrefillAnswers(gym);
    if (out.e_freeweights.kind !== "chips") throw new Error("expected chips");
    expect(out.e_freeweights.value).toEqual(["dumbbells"]);
    if (out.e_racks.kind !== "chips") throw new Error("expected chips");
    expect(out.e_racks.value).toEqual(["squat_rack"]);
    if (out.e_pilates.kind !== "chips") throw new Error("expected chips");
    expect(out.e_pilates.value).toEqual(["reformer"]);
    // a field with no present keys stays an empty (unanswered) chip set
    expect(out.e_combat).toEqual({ kind: "chips", value: [] });
  });

  it("estimated-tier equipment is prefilled as a selection without mutating its record", () => {
    const est = equipment("power_rack", { source: "estimated", confidence: 0.55 });
    const gym = makeGym({ equipment: [est] });
    const out = buildPrefillAnswers(gym);
    if (out.e_racks.kind !== "chips") throw new Error("expected chips");
    expect(out.e_racks.value).toContain("power_rack");
    expect(gym.equipment[0].source).toBe("estimated");
    expect(gym.equipment[0].confidence).toBe(0.55);
  });

  it("e_squat_count comes from the squat_rack quantity", () => {
    const out = buildPrefillAnswers(makeGym({ equipment: [equipment("squat_rack", { quantity: 6 })] }));
    expect(out.e_squat_count).toEqual({ kind: "num", value: 6 });
  });

  it("e_squat_count falls back to a power_rack row when there is no squat_rack row", () => {
    const out = buildPrefillAnswers(makeGym({ equipment: [equipment("power_rack", { quantity: 4 })] }));
    expect(out.e_squat_count).toEqual({ kind: "num", value: 4 });
  });

  it("squat_rack quantity wins over power_rack when both rows exist", () => {
    const out = buildPrefillAnswers(
      makeGym({
        equipment: [equipment("squat_rack", { quantity: 3 }), equipment("power_rack", { quantity: 9 })],
      }),
    );
    expect(out.e_squat_count).toEqual({ kind: "num", value: 3 });
  });

  it("a rack row with unknown quantity leaves the stepper unanswered", () => {
    const out = buildPrefillAnswers(makeGym({ equipment: [equipment("squat_rack", { quantity: null })] }));
    expect(out.e_squat_count).toEqual({ kind: "num", value: null });
  });

  it("e_db_max comes from the dumbbells max_weight_lbs (coerced to number)", () => {
    const out = buildPrefillAnswers(
      makeGym({ equipment: [equipment("dumbbells", { max_weight_lbs: "120" as unknown as number })] }),
    );
    expect(out.e_db_max).toEqual({ kind: "num", value: 120 });
  });

  it("brands split into matched chips (case-insensitive) and an 'other' note", () => {
    const gym = makeGym({
      equipment: [
        equipment("dumbbells", { brand: "Rogue" }),
        equipment("barbells", { brand: "Rogue" }), // identical strings dedupe to one chip
        equipment("treadmill", { brand: "hammer strength" }),
        equipment("cable_machine", { brand: "Bob's Custom Iron" }),
        equipment("squat_rack", { brand: null }),
      ],
    });
    const out = buildPrefillAnswers(gym);
    if (out.e_brands.kind !== "chips") throw new Error("expected chips");
    expect(out.e_brands.value).toEqual(["rogue", "hammer_strength"]);
    expect(out.e_brands_other).toEqual({ kind: "text", value: "Bob's Custom Iron" });
  });

  // DELIBERATE BUG-EXPOSING TEST: prefill.ts dedupes brand strings with an
  // exact-match Set BEFORE the case-insensitive chip match, so "Rogue" and
  // "rogue" on two rows both map to the "rogue" chip and the chips answer ends
  // up with a duplicate key — invalid chip-set state (a UI toggle-off removes
  // only one occurrence). Chip KEYS must be unique.
  it("brand chips never contain duplicate keys, even for case-variant brand strings", () => {
    const gym = makeGym({
      equipment: [
        equipment("dumbbells", { brand: "Rogue" }),
        equipment("barbells", { brand: "rogue" }),
      ],
    });
    const out = buildPrefillAnswers(gym);
    if (out.e_brands.kind !== "chips") throw new Error("expected chips");
    expect(out.e_brands.value).toEqual(["rogue"]);
  });

  it("no brands anywhere leaves both brand fields blank", () => {
    const out = buildPrefillAnswers(makeGym({ equipment: [equipment("dumbbells")] }));
    expect(out.e_brands).toEqual({ kind: "chips", value: [] });
    expect(out.e_brands_other).toEqual({ kind: "text", value: "" });
  });
});

describe("buildPrefillAnswers — parking (F) & vibe (H)", () => {
  it("uses the primary parking record over an earlier non-primary one", () => {
    const gym = makeGym({
      parking: [
        parking({ id: "pk-a", kind: "street", access: "paid", fee_detail: "$2/hr" }),
        parking({ id: "pk-b", kind: "onsite_garage", access: "validated", fee_detail: "1st hr free", is_primary: true }),
      ],
    });
    const out = buildPrefillAnswers(gym);
    expect(out.f_kind).toEqual({ kind: "choice", value: "onsite_garage" });
    expect(out.f_access).toEqual({ kind: "choice", value: "validated" });
    expect(out.f_fee).toEqual({ kind: "text", value: "1st hr free" });
  });

  it("falls back to the first record when nothing is flagged primary", () => {
    const gym = makeGym({ parking: [parking({ kind: "nearby_lot", access: "free" })] });
    const out = buildPrefillAnswers(gym);
    expect(out.f_kind).toEqual({ kind: "choice", value: "nearby_lot" });
    expect(out.f_access).toEqual({ kind: "choice", value: "free" });
    expect(out.f_fee).toEqual({ kind: "text", value: "" });
  });

  it("no parking records → parking fields stay unanswered", () => {
    const out = buildPrefillAnswers(makeGym({ parking: [] }));
    expect(out.f_kind).toEqual({ kind: "choice", value: null });
    expect(out.f_access).toEqual({ kind: "choice", value: null });
    expect(out.f_fee).toEqual({ kind: "text", value: "" });
  });

  it("h_vibes copies vibe_tags (a fresh array, not the gym's own)", () => {
    const gym = makeGym({ vibe_tags: ["old_school", "hardcore"] });
    const out = buildPrefillAnswers(gym);
    expect(out.h_vibes).toEqual({ kind: "chips", value: ["old_school", "hardcore"] });
    if (out.h_vibes.kind !== "chips") throw new Error("expected chips");
    expect(out.h_vibes.value).not.toBe(gym.vibe_tags);
    const none = buildPrefillAnswers(makeGym({ vibe_tags: [] }));
    expect(none.h_vibes).toEqual({ kind: "chips", value: [] });
  });
});

describe("buildPrefillAnswers — never fabricates and never mutates", () => {
  it("a fully-unknown gym prefills only its identity, everything else blank", () => {
    const gym = makeGym({ name: "Mystery Gym", address: null, phone: null, segment: null });
    const out = buildPrefillAnswers(gym);
    expect(out.a_name).toEqual({ kind: "text", value: "Mystery Gym" });
    const blank = emptyAnswers();
    for (const id of Object.keys(blank)) {
      if (id === "a_name") continue;
      expect(out[id], `field ${id} should be blank`).toEqual(blank[id]);
    }
  });

  it("does not mutate the input gym", () => {
    const gym = makeGym({
      hours: { open_24h: true, mon: ["06:00", "22:00"] },
      amenities: [amenity("sauna", { source: "estimated", confidence: 0.6 })],
      equipment: [equipment("squat_rack", { quantity: 2, brand: "Rogue" })],
      vibe_tags: ["community"],
      membership_plans: [{ name: "Basic", usage: null, prices: [{ term: "month_to_month", monthly: 29 }] }],
    });
    const snapshot = JSON.parse(JSON.stringify(gym));
    buildPrefillAnswers(gym);
    expect(gym).toEqual(snapshot);
  });
});
