import { describe, it, expect, vi } from "vitest";

// photoUrl.ts computes its allowed host from NEXT_PUBLIC_SUPABASE_URL at module
// load — pin it BEFORE parse.ts (→ photoUrl.ts) is imported so photo tests are
// deterministic on any machine.
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://unit-test.supabase.co";
});

import {
  parseSubmission,
  isOnOffValue,
  describeValue,
  DISCOUNT_COLUMNS,
  type ParseContext,
  type ParsedFact,
  type OnOffValue,
} from "./parse";
import { buildPrefillAnswers } from "./prefill";
import type { AnswerMap, PlanDraft } from "./answerTypes";
import { makeGym, amenity, equipment } from "@/lib/testFactory";
import type { EnrichedGym, GymParkingRecord } from "@/lib/types/scout";
import { AMENITY_LABELS, EQUIPMENT_LABELS } from "@/lib/types/scout";

const OWNER_PHOTO_URL =
  "https://unit-test.supabase.co/storage/v1/object/public/owner-photos/g1/a.jpg";

function ctx(baseline: AnswerMap, touched: string[] = []): ParseContext {
  return { baseline, touched: new Set(touched) };
}

/** Baseline + a deep-cloned answers map ready to mutate. */
function setup(gym: EnrichedGym) {
  const baseline = buildPrefillAnswers(gym);
  const answers: AnswerMap = structuredClone(baseline);
  return { baseline, answers };
}

const byKey = (facts: ParsedFact[], key: string) => facts.find((f) => f.key === key);

function parking(over: Partial<GymParkingRecord> = {}): GymParkingRecord {
  return {
    id: "p1",
    gym_id: "g1",
    kind: "onsite_lot",
    name: null,
    distance_m: null,
    access: "free",
    fee_detail: null,
    capacity: null,
    lat: null,
    lng: null,
    is_primary: true,
    source: "scraped",
    confidence: 0.85,
    detail: null,
    ...over,
  };
}

/** A rich gym: every prefillable surface populated (incl. estimated-tier equipment). */
function richGym(): EnrichedGym {
  return makeGym({
    name: "Iron Works",
    address: "1 Test St",
    phone: "813-555-0100",
    website: "https://ironworks.example",
    instagram: "ironworks",
    segment: "strength",
    day_pass_price: 15,
    monthly_from: 49,
    hours: { mon: ["06:00", "22:00"], tue: ["06:00", "22:00"] },
    pricing_notes: "Peak pricing applies",
    student_discount: true,
    no_contract_option: true,
    vibe_tags: ["hardcore"],
    amenities: [amenity("sauna")],
    equipment: [
      equipment("dumbbells", { source: "estimated", confidence: 0.6, max_weight_lbs: 100 }),
      equipment("squat_rack", { source: "estimated", confidence: 0.6, quantity: 4 }),
    ],
    parking: [parking()],
    membership_plans: [
      {
        name: "Standard",
        usage: null,
        prices: [{ term: "month_to_month", monthly: 49 }],
      },
    ],
  });
}

/* ── the differs-or-touched gate ─────────────────────────────────────── */

describe("parseSubmission — differs-or-touched gate", () => {
  it("a fully untouched prefilled submission emits ZERO facts (never launders prefill to owner tier)", () => {
    const gym = richGym();
    const { baseline, answers } = setup(gym);
    const res = parseSubmission(answers, gym, ctx(baseline));
    expect(res.facts).toEqual([]);
    expect(res.factCount).toBe(0);
    expect(res.conflictCount).toBe(0);
  });

  it("a changed scalar emits exactly one fact: ownerAction changed, conflict against the old value", () => {
    const gym = richGym();
    const { baseline, answers } = setup(gym);
    answers.c_daypass = { kind: "num", value: 20 };
    const res = parseSubmission(answers, gym, ctx(baseline));
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("scalar:day_pass_price");
    expect(f.target).toEqual({ type: "scalar", column: "day_pass_price" });
    expect(f.newValue).toBe(20);
    expect(f.oldValue).toBe(15);
    expect(f.conflict).toBe(true);
    expect(f.ownerAction).toBe("changed");
    expect(res.conflictCount).toBe(1);
  });

  it("an answer equal to the baseline but explicitly TOUCHED emits a confirmed fact (no conflict)", () => {
    const gym = richGym();
    const { baseline, answers } = setup(gym);
    const res = parseSubmission(answers, gym, ctx(baseline, ["c_daypass"]));
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("scalar:day_pass_price");
    expect(f.newValue).toBe(15);
    expect(f.ownerAction).toBe("confirmed");
    expect(f.conflict).toBe(false);
  });

  it("filling a previously-null column is changed but NOT a conflict", () => {
    const gym = makeGym({ week_pass_price: null });
    const { baseline, answers } = setup(gym);
    answers.c_weekpass = { kind: "num", value: 45 };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "scalar:week_pass_price");
    expect(f).toBeDefined();
    expect(f!.newValue).toBe(45);
    expect(f!.oldValue).toBeNull();
    expect(f!.conflict).toBe(false);
    expect(f!.ownerAction).toBe("changed");
  });

  it("clearing a prefilled text emits an explicit null fact (a 'this is wrong' signal), flagged as conflict", () => {
    const gym = richGym();
    const { baseline, answers } = setup(gym);
    answers.a_phone = { kind: "text", value: "" };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "scalar:phone");
    expect(f).toBeDefined();
    expect(f!.newValue).toBeNull();
    expect(f!.oldValue).toBe("813-555-0100");
    expect(f!.conflict).toBe(true);
    expect(f!.ownerAction).toBe("changed");
  });

  it("an answer for a field HIDDEN by segment visibility emits nothing (server-authoritative)", () => {
    // c_single_class only renders for class segments — a strength gym never sees it.
    const gym = makeGym({ segment: "strength" });
    const { baseline, answers } = setup(gym);
    answers.c_single_class = { kind: "num", value: 25 };
    const res = parseSubmission(answers, gym, ctx(baseline, ["c_single_class"]));
    expect(byKey(res.facts, "scalar:single_class_price")).toBeUndefined();
    expect(res.factCount).toBe(0);
  });

  it("a tampered equipment answer for a hidden branch field is ignored", () => {
    const gym = makeGym({ segment: "yoga_pilates" });
    const { baseline, answers } = setup(gym);
    // e_freeweights belongs to the strength_full branch — invisible for pilates.
    answers.e_freeweights = { kind: "chips", value: ["dumbbells", "barbells"] };
    const res = parseSubmission(answers, gym, ctx(baseline, ["e_freeweights"]));
    expect(byKey(res.facts, "equipment")).toBeUndefined();
    expect(res.factCount).toBe(0);
  });
});

/* ── scalars: numeric + instagram normalization ──────────────────────── */

describe("parseSubmission — scalar handling", () => {
  it("instagram: URL form of the same stored handle normalizes and does not conflict", () => {
    const gym = richGym(); // instagram: "ironworks"
    const { baseline, answers } = setup(gym);
    answers.a_instagram = { kind: "text", value: "https://instagram.com/ironworks" };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "scalar:instagram");
    expect(f).toBeDefined();
    expect(f!.newValue).toBe("ironworks");
    expect(f!.conflict).toBe(false);
  });

  it("instagram: an unnormalizable handle emits no fact", () => {
    const gym = makeGym({ instagram: null });
    const { baseline, answers } = setup(gym);
    answers.a_instagram = { kind: "text", value: "not a valid handle!!!" };
    const res = parseSubmission(answers, gym, ctx(baseline));
    expect(byKey(res.facts, "scalar:instagram")).toBeUndefined();
  });

  it("numeric equality coerces the old value (no false conflict on equal numbers)", () => {
    const gym = makeGym({ monthly_from: 49 });
    const { baseline, answers } = setup(gym);
    const res = parseSubmission(answers, gym, ctx(baseline, ["c_monthly"]));
    const f = byKey(res.facts, "scalar:monthly_from");
    expect(f).toBeDefined();
    expect(f!.conflict).toBe(false);
    expect(f!.ownerAction).toBe("confirmed");
  });
});

/* ── tri-state booleans: unknown stays unknown ───────────────────────── */

describe("parseSubmission — tri-state booleans", () => {
  it("an answered tri (true) on an unknown column emits a bool fact without conflict", () => {
    const gym = makeGym({ waitlist: null });
    const { baseline, answers } = setup(gym);
    answers.m_waitlist = { kind: "tri", value: true };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "bool:waitlist");
    expect(f).toBeDefined();
    expect(f!.newValue).toBe(true);
    expect(f!.oldValue).toBeNull();
    expect(f!.conflict).toBe(false);
  });

  it("a touched-but-null tri emits NOTHING — unknown never becomes owner-attested false", () => {
    const gym = makeGym({ app_required_entry: null, waitlist: null });
    const { baseline, answers } = setup(gym);
    const res = parseSubmission(answers, gym, ctx(baseline, ["m_app_required", "m_waitlist"]));
    expect(byKey(res.facts, "bool:app_required_entry")).toBeUndefined();
    expect(byKey(res.facts, "bool:waitlist")).toBeUndefined();
  });

  it("an explicit tri false that contradicts a stored true is a conflict", () => {
    const gym = makeGym({ app_required_entry: true });
    const { baseline, answers } = setup(gym);
    answers.m_app_required = { kind: "tri", value: false };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "bool:app_required_entry");
    expect(f).toBeDefined();
    expect(f!.newValue).toBe(false);
    expect(f!.conflict).toBe(true);
  });
});

/* ── discounts / commitment: {on, off} semantics ─────────────────────── */

describe("parseSubmission — discounts (on/off)", () => {
  it("adding a discount attests the full selection; unmentioned keys land in NEITHER list", () => {
    const gym = makeGym({ student_discount: true });
    const { baseline, answers } = setup(gym);
    answers.m_discounts = { kind: "chips", value: ["student", "military"] };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "discounts");
    expect(f).toBeDefined();
    const v = f!.newValue as OnOffValue;
    expect([...v.on].sort()).toEqual(["military", "student"]);
    expect(v.off).toEqual([]);
    expect(f!.conflict).toBe(false);
    // senior/corporate/family were never mentioned — must not appear anywhere
    for (const k of ["senior", "corporate", "family"]) {
      expect(v.on).not.toContain(k);
      expect(v.off).not.toContain(k);
    }
  });

  it("deselecting a prefilled discount is an explicit OFF (conflict), never silence", () => {
    const gym = makeGym({ student_discount: true, military_discount: true });
    const { baseline, answers } = setup(gym);
    answers.m_discounts = { kind: "chips", value: ["military"] };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "discounts");
    expect(f).toBeDefined();
    const v = f!.newValue as OnOffValue;
    expect(v.on).toEqual(["military"]);
    expect(v.off).toEqual(["student"]);
    expect(f!.conflict).toBe(true);
  });

  it("touched-but-empty discounts on a gym with no discount data emits nothing (unknown → unknown)", () => {
    const gym = makeGym();
    const { baseline, answers } = setup(gym);
    const res = parseSubmission(answers, gym, ctx(baseline, ["m_discounts"]));
    expect(byKey(res.facts, "discounts")).toBeUndefined();
  });
});

describe("parseSubmission — commitment terms (on/off)", () => {
  it("deselecting the prefilled month-to-month emits an off entry with conflict", () => {
    const gym = makeGym({ no_contract_option: true });
    const { baseline, answers } = setup(gym);
    answers.m_commitment = { kind: "chips", value: [] };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "commitment");
    expect(f).toBeDefined();
    expect(f!.newValue).toEqual({ on: [], off: ["month_to_month"] });
    expect(f!.oldValue).toEqual({ min_commitment_months: null, no_contract_option: true });
    expect(f!.conflict).toBe(true);
  });

  it("touched-but-empty commitment on an unknown-commitment gym emits nothing", () => {
    const gym = makeGym();
    const { baseline, answers } = setup(gym);
    const res = parseSubmission(answers, gym, ctx(baseline, ["m_commitment"]));
    expect(byKey(res.facts, "commitment")).toBeUndefined();
  });
});

/* ── amenities: add / confirm / remove ───────────────────────────────── */

describe("parseSubmission — amenities", () => {
  it("adding a chip emits ONLY an added fact; the untouched kept chip is not confirmed", () => {
    const gym = makeGym({ amenities: [amenity("sauna")] });
    const { baseline, answers } = setup(gym);
    answers.d_amenities = { kind: "chips", value: ["sauna", "pool"] };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const added = byKey(res.facts, "amenities");
    expect(added).toBeDefined();
    expect(added!.newValue).toEqual(["pool"]);
    expect(added!.target).toEqual({ type: "amenitySet" });
    expect(added!.ownerAction).toBe("changed");
    expect(byKey(res.facts, "amenities-confirmed")).toBeUndefined();
    expect(byKey(res.facts, "amenities-removed")).toBeUndefined();
  });

  it("touching the field attests its whole state — kept prefill chips become confirmed", () => {
    const gym = makeGym({ amenities: [amenity("sauna")] });
    const { baseline, answers } = setup(gym);
    answers.d_amenities = { kind: "chips", value: ["sauna", "pool"] };
    const res = parseSubmission(answers, gym, ctx(baseline, ["d_amenities"]));
    expect(byKey(res.facts, "amenities")!.newValue).toEqual(["pool"]);
    const confirmed = byKey(res.facts, "amenities-confirmed");
    expect(confirmed).toBeDefined();
    expect(confirmed!.newValue).toEqual(["sauna"]);
    expect(confirmed!.ownerAction).toBe("confirmed");
  });

  it("removing a prefilled chip emits an explicit amenityRemove fact (present:false path), conflict", () => {
    const gym = makeGym({ amenities: [amenity("sauna"), amenity("pool")] });
    const { baseline, answers } = setup(gym);
    answers.d_amenities = { kind: "chips", value: ["pool"] };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const removed = byKey(res.facts, "amenities-removed");
    expect(removed).toBeDefined();
    expect(removed!.target).toEqual({ type: "amenityRemove" });
    expect(removed!.newValue).toEqual(["sauna"]);
    expect(removed!.conflict).toBe(true);
    expect(removed!.oldValue).toEqual(expect.arrayContaining(["sauna", "pool"]));
  });

  it("g_womens: explicit 'neither' on a womens_area gym is a removal; unanswered contributes nothing", () => {
    const gym = makeGym({ amenities: [amenity("womens_area")] });
    const { baseline, answers } = setup(gym);
    answers.g_womens = { kind: "choice", value: "neither" };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const removed = byKey(res.facts, "amenities-removed");
    expect(removed).toBeDefined();
    expect(removed!.newValue).toEqual(["womens_area"]);

    // unanswered (null) — nothing at all
    const { baseline: b2, answers: a2 } = setup(gym);
    a2.g_womens = { kind: "choice", value: null };
    const res2 = parseSubmission(a2, gym, ctx(b2));
    expect(res2.factCount).toBe(0);
  });
});

/* ── equipment: add / confirm / remove + estimated-tier protection ───── */

describe("parseSubmission — equipment", () => {
  const estGym = () =>
    makeGym({
      segment: "strength",
      equipment: [equipment("dumbbells", { source: "estimated", confidence: 0.6 })],
    });

  it("adding a chip emits an added fact; the untouched estimated-tier prefill is NOT re-emitted", () => {
    const gym = estGym();
    const { baseline, answers } = setup(gym);
    answers.e_freeweights = { kind: "chips", value: ["dumbbells", "barbells"] };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const added = byKey(res.facts, "equipment");
    expect(added).toBeDefined();
    expect(added!.newValue).toEqual(["barbells"]);
    expect(added!.target).toEqual({ type: "equipmentSet" });
    // dumbbells (estimated, untouched) must not appear in ANY owner fact
    expect(byKey(res.facts, "equipment-confirmed")).toBeUndefined();
    expect(byKey(res.facts, "equipment-removed")).toBeUndefined();
  });

  it("touching the field upgrades kept prefill chips to an explicit confirmed fact", () => {
    const gym = estGym();
    const { baseline, answers } = setup(gym);
    const res = parseSubmission(answers, gym, ctx(baseline, ["e_freeweights"]));
    const confirmed = byKey(res.facts, "equipment-confirmed");
    expect(confirmed).toBeDefined();
    expect(confirmed!.newValue).toEqual(["dumbbells"]);
    expect(confirmed!.ownerAction).toBe("confirmed");
    expect(byKey(res.facts, "equipment")).toBeUndefined();
  });

  it("deselecting every prefilled chip emits an equipmentRemove fact, not silence", () => {
    const gym = estGym();
    const { baseline, answers } = setup(gym);
    answers.e_freeweights = { kind: "chips", value: [] };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const removed = byKey(res.facts, "equipment-removed");
    expect(removed).toBeDefined();
    expect(removed!.target).toEqual({ type: "equipmentRemove" });
    expect(removed!.newValue).toEqual(["dumbbells"]);
    expect(removed!.conflict).toBe(true);
  });
});

/* ── equipment attributes: rack key resolution + dumbbell max ────────── */

describe("parseSubmission — equipment attributes", () => {
  it("squat count lands on the power_rack row when the gym only has a power_rack (key resolution)", () => {
    const gym = makeGym({
      segment: "strength",
      equipment: [equipment("power_rack", { quantity: 3 })],
    });
    const { baseline, answers } = setup(gym);
    answers.e_squat_count = { kind: "num", value: 5 };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "equip-attr:power_rack:quantity");
    expect(f).toBeDefined();
    expect(f!.target).toEqual({ type: "equipmentAttr", equipmentKey: "power_rack", attr: "quantity" });
    expect(f!.newValue).toBe(5);
    expect(f!.oldValue).toBe(3);
    expect(byKey(res.facts, "equip-attr:squat_rack:quantity")).toBeUndefined();
  });

  it("squat_rack wins over power_rack when both rows exist", () => {
    const gym = makeGym({
      segment: "strength",
      equipment: [equipment("squat_rack", { quantity: 2 }), equipment("power_rack", { quantity: 3 })],
    });
    const { baseline, answers } = setup(gym);
    answers.e_squat_count = { kind: "num", value: 6 };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "equip-attr:squat_rack:quantity");
    expect(f).toBeDefined();
    expect(f!.oldValue).toBe(2);
  });

  it("a zero count with NO existing rack row emits nothing (never fabricates a rack row)", () => {
    const gym = makeGym({ segment: "strength", equipment: [] });
    const { baseline, answers } = setup(gym);
    answers.e_squat_count = { kind: "num", value: 0 };
    const res = parseSubmission(answers, gym, ctx(baseline));
    expect(res.facts.filter((f) => f.key.startsWith("equip-attr:"))).toEqual([]);
  });

  it("a positive count with no rack row defaults to squat_rack with a null old value", () => {
    const gym = makeGym({ segment: "strength", equipment: [] });
    const { baseline, answers } = setup(gym);
    answers.e_squat_count = { kind: "num", value: 4 };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "equip-attr:squat_rack:quantity");
    expect(f).toBeDefined();
    expect(f!.newValue).toBe(4);
    expect(f!.oldValue).toBeNull();
  });

  it("dumbbell max change targets the dumbbells row's max_weight_lbs", () => {
    const gym = makeGym({
      segment: "strength",
      equipment: [equipment("dumbbells", { max_weight_lbs: 100 })],
    });
    const { baseline, answers } = setup(gym);
    answers.e_db_max = { kind: "num", value: 120 };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "equip-attr:dumbbells:max_weight_lbs");
    expect(f).toBeDefined();
    expect(f!.target).toEqual({ type: "equipmentAttr", equipmentKey: "dumbbells", attr: "max_weight_lbs" });
    expect(f!.newValue).toBe(120);
    expect(f!.oldValue).toBe(100);
  });
});

/* ── hours sanitization ──────────────────────────────────────────────── */

describe("parseSubmission — hours", () => {
  it("a day toggled open with blank times is DROPPED; complete days ship; open_24h never rides", () => {
    const gym = makeGym({ hours: null });
    const { baseline, answers } = setup(gym);
    answers.b_hours = {
      kind: "hours",
      value: { open_24h: true, mon: ["09:00", ""], tue: ["06:00", "22:00"] },
    };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "hours");
    expect(f).toBeDefined();
    expect(f!.newValue).toEqual({ tue: ["06:00", "22:00"] });
    expect(f!.conflict).toBe(false); // gym.hours was null
  });

  it("hours with ONLY blank-time days emit no fact (would falsely read as open)", () => {
    const gym = makeGym({ hours: null });
    const { baseline, answers } = setup(gym);
    answers.b_hours = { kind: "hours", value: { mon: ["", ""], tue: ["09:00", ""] } };
    const res = parseSubmission(answers, gym, ctx(baseline, ["b_hours"]));
    expect(byKey(res.facts, "hours")).toBeUndefined();
  });

  it("changed hours over existing hours is a conflict", () => {
    const gym = makeGym({ hours: { mon: ["06:00", "22:00"] } });
    const { baseline, answers } = setup(gym);
    answers.b_hours = { kind: "hours", value: { mon: ["07:00", "21:00"] } };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "hours");
    expect(f).toBeDefined();
    expect(f!.conflict).toBe(true);
  });

  it("b_access = staffed_24 hides the hours grid — no hours fact even when the grid changed", () => {
    const gym = makeGym({ hours: null });
    const { baseline, answers } = setup(gym);
    answers.b_access = { kind: "choice", value: "staffed_24" };
    answers.b_hours = { kind: "hours", value: { mon: ["06:00", "22:00"] } };
    const res = parseSubmission(answers, gym, ctx(baseline, ["b_hours"]));
    expect(byKey(res.facts, "hours")).toBeUndefined();
  });
});

/* ── membership plans ────────────────────────────────────────────────── */

describe("parseSubmission — membership plans", () => {
  const draft: PlanDraft = {
    name: "Standard",
    usageType: null,
    usageCount: null,
    prices: [
      { term: "month_to_month", monthly: 49 },
      { term: "6_month", monthly: 44 },
      { term: "12_month", monthly: 39 },
    ],
  };

  it("owner-added plans on a plan-less gym emit a plans fact without conflict", () => {
    const gym = makeGym({ membership_plans: null });
    const { baseline, answers } = setup(gym);
    answers.m_plans = { kind: "plans", value: [draft] };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "plans");
    expect(f).toBeDefined();
    expect(f!.label).toBe("Membership plans (1)");
    expect(f!.newValue).toEqual([draft]);
    expect(f!.conflict).toBe(false);
    expect(f!.ownerAction).toBe("changed");
  });

  it("an untouched prefilled plan list emits nothing (no silent lossy rewrite)", () => {
    const gym = makeGym({
      membership_plans: [{ name: "Standard", usage: null, prices: [{ term: "month_to_month", monthly: 49 }] }],
    });
    const { baseline, answers } = setup(gym);
    const res = parseSubmission(answers, gym, ctx(baseline));
    expect(byKey(res.facts, "plans")).toBeUndefined();
    expect(res.factCount).toBe(0);
  });

  it("changed plans over existing plans is a conflict", () => {
    const gym = makeGym({
      membership_plans: [{ name: "Old", usage: null, prices: [{ term: "month_to_month", monthly: 59 }] }],
    });
    const { baseline, answers } = setup(gym);
    answers.m_plans = { kind: "plans", value: [draft] };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "plans");
    expect(f).toBeDefined();
    expect(f!.conflict).toBe(true);
  });
});

/* ── vibes, photos, parking, brands, early termination ───────────────── */

describe("parseSubmission — vibes", () => {
  it("deselecting a prefilled vibe is a removal (conflict), wholesale-replace value", () => {
    const gym = makeGym({ vibe_tags: ["hardcore"] });
    const { baseline, answers } = setup(gym);
    answers.h_vibes = { kind: "chips", value: [] };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "vibes");
    expect(f).toBeDefined();
    expect(f!.newValue).toEqual([]);
    expect(f!.conflict).toBe(true);
  });
});

describe("parseSubmission — photos", () => {
  const photoAnswer = (url: string) => ({ kind: "photo" as const, value: [{ path: "g1/a.jpg", url }] });

  it("valid storage URL + rights affirmed → photos fact (plus the rights info fact)", () => {
    const gym = makeGym();
    const { baseline, answers } = setup(gym);
    answers.i_photos = photoAnswer(OWNER_PHOTO_URL);
    answers.i_photo_rights = { kind: "tri", value: true };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "photos");
    expect(f).toBeDefined();
    expect(f!.target).toEqual({ type: "photos" });
    expect((f!.newValue as unknown[]).length).toBe(1);
    expect(byKey(res.facts, "photos-held")).toBeUndefined();
    expect(byKey(res.facts, "info:i_photo_rights")?.newValue).toBe("Yes");
  });

  it("valid URL WITHOUT rights affirmation → held (info fact, conflict), never published", () => {
    const gym = makeGym();
    const { baseline, answers } = setup(gym);
    answers.i_photos = photoAnswer(OWNER_PHOTO_URL);
    const res = parseSubmission(answers, gym, ctx(baseline));
    expect(byKey(res.facts, "photos")).toBeUndefined();
    const held = byKey(res.facts, "photos-held");
    expect(held).toBeDefined();
    expect(held!.conflict).toBe(true);
    expect(held!.target).toEqual({ type: "info", field: "i_photos" });
  });

  it("an off-domain photo URL is dropped entirely — no photos or held fact", () => {
    const gym = makeGym();
    const { baseline, answers } = setup(gym);
    answers.i_photos = photoAnswer("https://evil.example/storage/v1/object/public/owner-photos/x.jpg");
    answers.i_photo_rights = { kind: "tri", value: true };
    const res = parseSubmission(answers, gym, ctx(baseline));
    expect(byKey(res.facts, "photos")).toBeUndefined();
    expect(byKey(res.facts, "photos-held")).toBeUndefined();
  });
});

describe("parseSubmission — parking", () => {
  it("changing the kind on a gym with an existing primary spot conflicts and carries all three fields", () => {
    const gym = makeGym({ parking: [parking({ kind: "onsite_lot", access: "free" })] });
    const { baseline, answers } = setup(gym);
    answers.f_kind = { kind: "choice", value: "street" };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "parking");
    expect(f).toBeDefined();
    expect(f!.newValue).toEqual({ kind: "street", access: "free", fee_detail: null });
    expect(f!.oldValue).toEqual({ kind: "onsite_lot", access: "free" });
    expect(f!.conflict).toBe(true);
    expect(f!.ownerAction).toBe("changed");
  });

  it("first-time parking info on a parking-less gym has no conflict and a null old value", () => {
    const gym = makeGym({ parking: [] });
    const { baseline, answers } = setup(gym);
    answers.f_kind = { kind: "choice", value: "onsite_garage" };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "parking");
    expect(f).toBeDefined();
    expect(f!.oldValue).toBeNull();
    expect(f!.conflict).toBe(false);
  });
});

describe("parseSubmission — equipment brands", () => {
  it("brand chips plus the free-text 'other' merge into one list", () => {
    const gym = makeGym({ segment: "strength" });
    const { baseline, answers } = setup(gym);
    answers.e_brands = { kind: "chips", value: ["rogue"] };
    answers.e_brands_other = { kind: "text", value: "  Watson Custom  " };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "brands");
    expect(f).toBeDefined();
    expect(f!.newValue).toEqual(["rogue", "Watson Custom"]);
    expect(f!.ownerAction).toBe("changed");
  });
});

describe("parseSubmission — early termination", () => {
  it("choice + detail note combine into the earlyTermination fact", () => {
    const gym = makeGym();
    const { baseline, answers } = setup(gym);
    // m_early_term is only visible when a contract term is offered
    answers.m_commitment = { kind: "chips", value: ["12_month"] };
    answers.m_early_term = { kind: "choice", value: "flat_fee" };
    answers.m_early_term_note = { kind: "text", value: "$99 buyout" };
    const res = parseSubmission(answers, gym, ctx(baseline));
    const f = byKey(res.facts, "earlyTermination");
    expect(f).toBeDefined();
    expect(f!.newValue).toEqual({ type: "flat_fee", note: "$99 buyout" });
    expect(f!.conflict).toBe(false); // gym.early_termination was null
  });

  it("no early-termination fact when the contract gate is not met (field hidden)", () => {
    const gym = makeGym();
    const { baseline, answers } = setup(gym);
    answers.m_early_term = { kind: "choice", value: "flat_fee" }; // hidden: no contract term selected
    const res = parseSubmission(answers, gym, ctx(baseline));
    expect(byKey(res.facts, "earlyTermination")).toBeUndefined();
  });
});

/* ── informational fields ────────────────────────────────────────────── */

describe("parseSubmission — info fields", () => {
  it("text, tri, choice and chips info answers render as display strings, never catalog writes", () => {
    const gym = makeGym();
    const { baseline, answers } = setup(gym);
    answers.h_diff = { kind: "text", value: "For serious lifters" };
    answers.g_youth = { kind: "tri", value: true };
    answers.g_min_age = { kind: "choice", value: "16" };
    answers.a_secondary = { kind: "chips", value: ["yoga_pilates"] };
    const res = parseSubmission(answers, gym, ctx(baseline));

    const diff = byKey(res.facts, "info:h_diff");
    expect(diff?.newValue).toBe("For serious lifters");
    expect(diff?.target).toEqual({ type: "info", field: "h_diff" });
    expect(byKey(res.facts, "info:g_youth")?.newValue).toBe("Yes");
    expect(byKey(res.facts, "info:g_min_age")?.newValue).toBe("16");
    expect(byKey(res.facts, "info:a_secondary")?.newValue).toBe("yoga pilates");
  });

  it("an untouched-empty info field emits nothing", () => {
    const gym = makeGym();
    const { baseline, answers } = setup(gym);
    const res = parseSubmission(answers, gym, ctx(baseline, ["h_diff", "g_youth"]));
    expect(res.facts.filter((f) => f.key.startsWith("info:"))).toEqual([]);
  });
});

/* ── exported pure helpers ───────────────────────────────────────────── */

describe("isOnOffValue", () => {
  it("accepts exactly the {on: [], off: []} shape", () => {
    expect(isOnOffValue({ on: [], off: [] })).toBe(true);
    expect(isOnOffValue({ on: ["student"], off: ["family"] })).toBe(true);
  });

  it("rejects arrays, null, partial shapes, and primitives", () => {
    expect(isOnOffValue(["student"])).toBe(false);
    expect(isOnOffValue(null)).toBe(false);
    expect(isOnOffValue(undefined)).toBe(false);
    expect(isOnOffValue({ on: [] })).toBe(false);
    expect(isOnOffValue({ off: [] })).toBe(false);
    expect(isOnOffValue("student")).toBe(false);
    expect(isOnOffValue(42)).toBe(false);
  });
});

describe("DISCOUNT_COLUMNS", () => {
  it("maps each chip key to its exact gyms boolean column", () => {
    expect(DISCOUNT_COLUMNS).toEqual({
      student: "student_discount",
      military: "military_discount",
      senior: "senior_discount",
      corporate: "corporate_discount",
      family: "family_plans",
    });
  });
});

describe("describeValue", () => {
  it("null/undefined → Unlisted; booleans → Yes/No", () => {
    expect(describeValue({ type: "scalar", column: "phone" }, null)).toBe("Unlisted");
    expect(describeValue({ type: "hours" }, undefined)).toBe("Unlisted");
    expect(describeValue({ type: "bool", column: "waitlist" }, true)).toBe("Yes");
    expect(describeValue({ type: "bool", column: "waitlist" }, false)).toBe("No");
  });

  it("legacy count-number values render per target type", () => {
    expect(describeValue({ type: "amenitySet" }, 3)).toBe("3 present");
    expect(describeValue({ type: "equipmentSet" }, 7)).toBe("7 present");
    expect(describeValue({ type: "plans" }, 2)).toBe("2 plan(s)");
    expect(describeValue({ type: "brands" }, 4)).toBe("4 on file");
    expect(describeValue({ type: "scalar", column: "day_pass_price" }, 12)).toBe("12");
  });

  it("amenity/equipment lists map keys to labels (unknown keys pass through)", () => {
    expect(describeValue({ type: "amenitySet" }, ["sauna"])).toBe(AMENITY_LABELS.sauna);
    expect(describeValue({ type: "amenityRemove" }, ["sauna", "mystery_key"])).toBe(
      `${AMENITY_LABELS.sauna}, mystery_key`,
    );
    expect(describeValue({ type: "equipmentSet" }, ["dumbbells"])).toBe(EQUIPMENT_LABELS.dumbbells);
    expect(describeValue({ type: "equipmentRemove" }, ["dumbbells"])).toBe(EQUIPMENT_LABELS.dumbbells);
  });

  it("discounts: {on, off} shape and the LEGACY string[] shape both render", () => {
    expect(describeValue({ type: "discounts" }, { on: ["student"], off: ["military"] })).toBe(
      "student — removes: military",
    );
    expect(describeValue({ type: "discounts" }, { on: [], off: [] })).toBe("None");
    // legacy string[] (pre-on/off submissions)
    expect(describeValue({ type: "discounts" }, ["student", "military"])).toBe("student, military");
    expect(describeValue({ type: "discounts" }, [])).toBe("None");
  });

  it("commitment: legacy string[], on/off, and the columns-shaped oldValue all render", () => {
    expect(describeValue({ type: "commitment" }, ["month_to_month"])).toBe("month to month");
    expect(describeValue({ type: "commitment" }, { on: ["12_month"], off: [] })).toBe("12 month");
    expect(
      describeValue({ type: "commitment" }, { min_commitment_months: 12, no_contract_option: false }),
    ).toBe("12-mo min · contract only");
    expect(
      describeValue({ type: "commitment" }, { min_commitment_months: null, no_contract_option: true }),
    ).toBe("month-to-month");
    expect(
      describeValue({ type: "commitment" }, { min_commitment_months: null, no_contract_option: null }),
    ).toBe("Unlisted");
  });

  it("hours/photos/vibes/plans/parking/earlyTermination/info shapes", () => {
    expect(describeValue({ type: "hours" }, { mon: ["06:00", "22:00"] })).toBe("schedule");
    expect(describeValue({ type: "photos" }, [{ url: "a" }, { url: "b" }])).toBe("2 photo(s)");
    expect(describeValue({ type: "vibes" }, ["hardcore", "no_frills"])).toBe("hardcore, no_frills");
    expect(describeValue({ type: "vibes" }, [])).toBe("None");
    const drafts: PlanDraft[] = [
      { name: "Standard", usageType: null, usageCount: null, prices: [] },
      { name: "   ", usageType: null, usageCount: null, prices: [] },
    ];
    expect(describeValue({ type: "plans" }, drafts)).toBe("1 plan(s)");
    expect(
      describeValue({ type: "parking" }, { kind: "street", access: "free", fee_detail: null }),
    ).toBe("street · free");
    expect(describeValue({ type: "parking" }, {})).toBe("—");
    expect(
      describeValue({ type: "earlyTermination" }, { type: "flat_fee", note: "$99" }),
    ).toBe("flat_fee · $99");
    expect(describeValue({ type: "earlyTermination" }, {})).toBe("—");
    expect(describeValue({ type: "info", field: "h_diff" }, "hello")).toBe("hello");
  });
});
