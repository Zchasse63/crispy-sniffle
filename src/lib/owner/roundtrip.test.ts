/**
 * Crown-jewel invariant: the prefill -> (owner edits) -> parse round trip.
 *
 * Mirrors the production wiring in app/api/owner/submit/route.ts: the server
 * rebuilds the baseline via buildPrefillAnswers(gym) and calls
 * parseSubmission(answers, gym, { baseline, touched }). The client's answer
 * map starts as that same prefill, so:
 *   - an UNTOUCHED submit must emit ZERO facts (never launder prefill —
 *     including estimated-tier data — up to owner/0.95),
 *   - a single edit must emit exactly one correct owner-tier fact,
 *   - removing a prefilled chip must emit an explicit removal fact,
 *   - a day toggled "open" with blank times must never ship.
 */
import { describe, it, expect } from "vitest";
import { parseSubmission } from "./parse";
import { buildPrefillAnswers } from "./prefill";
import { sanitizeHours, answerEquals, chipSetDiff } from "./diff";
import type { AnswerMap } from "./answerTypes";
import { isAnswered } from "./answerTypes";
import { makeGym, amenity, equipment } from "@/lib/testFactory";
import type { EnrichedGym, GymParkingRecord } from "@/lib/types/scout";

/* ── fixtures ─────────────────────────────────────────────────────────── */

const primaryParking: GymParkingRecord = {
  id: "park-1",
  gym_id: "gym-x",
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
};

/** A realistic, richly-populated strength gym exercising most prefill paths.
 *  Includes estimated-tier rows on purpose: those must never round-trip into
 *  owner facts when untouched. */
function richGym(): EnrichedGym {
  return makeGym({
    name: "Iron Works Barbell",
    address: "123 Bay St, Tampa, FL",
    phone: "813-555-0100",
    website: "https://ironworksbarbell.com",
    instagram: "ironworksbarbell",
    segment: "strength",
    hours: { open_24h: false, mon: ["06:00", "22:00"], tue: ["06:00", "22:00"], sat: ["08:00", "18:00"] },
    day_pass_price: 20,
    week_pass_price: 60,
    monthly_from: 49,
    intro_offer: "First week free",
    pricing_notes: "Peak pricing applies on weekdays",
    enrollment_fee: 49,
    annual_fee: 59,
    annual_fee_label: "Club enhancement fee",
    cancellation_notice_days: 30,
    freeze_policy: "Up to 3 months, $10/mo",
    min_commitment_months: 12,
    no_contract_option: true,
    early_termination: { type: "flat_fee", note: "$99 flat fee" },
    app_required_entry: true,
    student_discount: true,
    membership_plans: [
      {
        name: "Standard",
        usage: { type: "unlimited" },
        prices: [
          { term: "month_to_month", monthly: 59 },
          { term: "12_month", monthly: 49 },
        ],
      },
    ],
    vibe_tags: ["hardcore", "old_school"],
    amenities: [
      amenity("sauna"),
      // estimated-tier amenity: prefilled chip, must NOT become owner on untouched submit
      amenity("cold_plunge", { source: "estimated", confidence: 0.6 }),
      amenity("lockers"),
      amenity("showers"),
      amenity("wheelchair_accessible"),
      amenity("womens_area"),
    ],
    equipment: [
      // estimated-tier equipment row (incl. its quantity): same rule
      equipment("squat_rack", { quantity: 4, source: "estimated", confidence: 0.6 }),
      equipment("dumbbells", { max_weight_lbs: 100, brand: "Rogue" }),
      equipment("barbells"),
      equipment("treadmill"),
      equipment("platform"),
    ],
    parking: [primaryParking],
  });
}

/** Production round trip: client answers start as the prefill; the server
 *  rebuilds its OWN baseline (separate object) exactly like submit/route.ts. */
function roundTrip(
  gym: EnrichedGym,
  mutate: (answers: AnswerMap) => void = () => {},
  touched: string[] = [],
) {
  const answers = buildPrefillAnswers(gym); // what the client was handed
  mutate(answers); // the owner's edits
  const baseline = buildPrefillAnswers(gym); // server-rebuilt baseline
  return parseSubmission(answers, gym, { baseline, touched: new Set(touched) });
}

/* ── (1) untouched submit: ZERO facts, no laundering ──────────────────── */

describe("round trip — untouched prefill emits nothing", () => {
  it("a rich gym submitted untouched emits ZERO facts", () => {
    const res = roundTrip(richGym());
    expect(res.facts).toEqual([]);
    expect(res.factCount).toBe(0);
    expect(res.conflictCount).toBe(0);
  });

  it("estimated-tier prefill (equipment + amenity) is never laundered to owner when untouched", () => {
    const gym = makeGym({
      segment: "strength",
      amenities: [amenity("cold_plunge", { source: "estimated", confidence: 0.6 })],
      equipment: [equipment("squat_rack", { quantity: 3, source: "estimated", confidence: 0.55 })],
    });
    const res = roundTrip(gym);
    expect(res.facts).toEqual([]);
  });

  it("an all-unknown gym submitted untouched emits ZERO facts (unknown stays unknown)", () => {
    const res = roundTrip(makeGym({ segment: "strength" }));
    expect(res.facts).toEqual([]);
  });

  it("touching every UNANSWERED field without answering fabricates nothing", () => {
    const gym = makeGym({ segment: "strength" });
    const answers = buildPrefillAnswers(gym);
    // Touch every field that has NO prefill signal (empty/null answer). Even
    // an explicit touch must not turn an unknown into an owner-attested value.
    const unansweredIds = Object.keys(answers).filter((id) => !isAnswered(answers[id]));
    expect(unansweredIds.length).toBeGreaterThan(10); // sanity: mostly unknown gym
    const res = parseSubmission(answers, gym, {
      baseline: buildPrefillAnswers(gym),
      touched: new Set(unansweredIds),
    });
    expect(res.facts).toEqual([]);
  });
});

/* ── (2) exactly one edit -> exactly one correct fact ─────────────────── */

describe("round trip — a single owner edit emits exactly one correct fact", () => {
  it("changing the day-pass price emits one changed scalar fact with old/new values", () => {
    const res = roundTrip(richGym(), (a) => {
      a.c_daypass = { kind: "num", value: 25 };
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("scalar:day_pass_price");
    expect(f.target).toEqual({ type: "scalar", column: "day_pass_price" });
    expect(f.newValue).toBe(25);
    expect(f.oldValue).toBe(20);
    expect(f.ownerAction).toBe("changed");
    expect(f.conflict).toBe(true); // overwrites an existing non-null value
    expect(res.conflictCount).toBe(1);
  });

  it("adding one amenity chip emits one amenitySet fact with only the added key", () => {
    const res = roundTrip(richGym(), (a) => {
      if (a.d_amenities.kind === "chips") a.d_amenities.value.push("steam_room");
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("amenities");
    expect(f.target).toEqual({ type: "amenitySet" });
    expect(f.newValue).toEqual(["steam_room"]); // only the delta, never the kept prefill
    expect(f.ownerAction).toBe("changed");
    expect(f.conflict).toBe(false);
  });

  it("clearing a prefilled scalar is an explicit 'this is wrong' fact (null), not silence", () => {
    const res = roundTrip(richGym(), (a) => {
      a.c_daypass = { kind: "num", value: null };
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("scalar:day_pass_price");
    expect(f.newValue).toBeNull();
    expect(f.oldValue).toBe(20);
    expect(f.conflict).toBe(true);
    expect(f.ownerAction).toBe("changed");
  });

  it("touched-but-unchanged scalar emits a 'confirmed' fact (explicit attestation only)", () => {
    const res = roundTrip(richGym(), () => {}, ["c_monthly"]);
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("scalar:monthly_from");
    expect(f.newValue).toBe(49);
    expect(f.ownerAction).toBe("confirmed");
    expect(f.conflict).toBe(false);
  });

  it("changing an estimated equipment quantity lands on the real rack row", () => {
    const res = roundTrip(richGym(), (a) => {
      a.e_squat_count = { kind: "num", value: 6 };
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.target).toEqual({ type: "equipmentAttr", equipmentKey: "squat_rack", attr: "quantity" });
    expect(f.newValue).toBe(6);
    expect(f.oldValue).toBe(4);
    expect(f.ownerAction).toBe("changed");
  });

  it("a zero rack count on a gym with NO rack row fabricates nothing", () => {
    const res = roundTrip(
      makeGym({ segment: "strength" }),
      (a) => {
        a.e_squat_count = { kind: "num", value: 0 };
      },
      ["e_squat_count"],
    );
    expect(res.facts).toEqual([]);
  });

  it("setting an unanswered tri-state to an explicit No emits one bool fact (null oldValue)", () => {
    const res = roundTrip(makeGym({ segment: "strength" }), (a) => {
      a.m_waitlist = { kind: "tri", value: false };
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("bool:waitlist");
    expect(f.newValue).toBe(false);
    expect(f.oldValue).toBeNull();
    expect(f.conflict).toBe(false);
    expect(f.ownerAction).toBe("changed");
  });
});

/* ── (3) removing a prefilled chip -> explicit removal fact ───────────── */

describe("round trip — chip removals are explicit, never silent", () => {
  it("removing the prefilled sauna chip emits an amenityRemove fact (-> present:false)", () => {
    const res = roundTrip(richGym(), (a) => {
      if (a.d_amenities.kind === "chips") {
        a.d_amenities.value = a.d_amenities.value.filter((k) => k !== "sauna");
      }
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("amenities-removed");
    expect(f.target).toEqual({ type: "amenityRemove" });
    expect(f.newValue).toEqual(["sauna"]);
    expect(f.conflict).toBe(true); // removals always demand reviewer attention
    expect(f.ownerAction).toBe("changed");
  });

  it("removing a prefilled equipment chip emits an equipmentRemove fact", () => {
    const res = roundTrip(richGym(), (a) => {
      if (a.e_cardio_s?.kind === "chips") {
        a.e_cardio_s.value = a.e_cardio_s.value.filter((k) => k !== "treadmill");
      }
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("equipment-removed");
    expect(f.target).toEqual({ type: "equipmentRemove" });
    expect(f.newValue).toEqual(["treadmill"]);
    expect(f.conflict).toBe(true);
  });

  it("answering 'neither' for women's-only removes the prefilled womens_area amenity", () => {
    const res = roundTrip(richGym(), (a) => {
      a.g_womens = { kind: "choice", value: "neither" };
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("amenities-removed");
    expect(f.newValue).toEqual(["womens_area"]);
    expect(f.conflict).toBe(true);
  });

  it("deselecting the prefilled student discount lists it in `off`; unmentioned keys in NEITHER list", () => {
    const res = roundTrip(richGym(), (a) => {
      if (a.m_discounts.kind === "chips") a.m_discounts.value = [];
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("discounts");
    expect(f.newValue).toEqual({ on: [], off: ["student"] });
    expect(f.conflict).toBe(true);
    // military/senior/corporate/family were never mentioned — absent from both
    // lists so their (null) columns are never written as owner-attested false.
  });

  it("selecting a discount on an all-null gym attests ONLY that key (unknown -> unknown for the rest)", () => {
    const res = roundTrip(makeGym({ segment: "strength" }), (a) => {
      a.m_discounts = { kind: "chips", value: ["military"] };
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("discounts");
    expect(f.newValue).toEqual({ on: ["military"], off: [] });
    expect(f.conflict).toBe(false);
  });
});

/* ── (4) hours: blank "open" days never ship ──────────────────────────── */

describe("round trip — hours sanitization", () => {
  it("a day toggled open with blank times is NOT published (would read as open 24h)", () => {
    const res = roundTrip(
      makeGym({ segment: "strength", hours: null }),
      (a) => {
        a.b_hours = { kind: "hours", value: { mon: ["", ""] } };
      },
      ["b_hours"],
    );
    expect(res.facts).toEqual([]);
  });

  it("a mixed grid ships ONLY the complete days — the blank day is dropped", () => {
    const res = roundTrip(makeGym({ segment: "strength", hours: null }), (a) => {
      a.b_hours = { kind: "hours", value: { mon: ["06:00", "14:00"], tue: ["", ""] } };
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("hours");
    expect(f.target).toEqual({ type: "hours" });
    expect(f.newValue).toEqual({ mon: ["06:00", "14:00"] });
    expect(f.newValue).not.toHaveProperty("tue");
    expect(f.newValue).not.toHaveProperty("open_24h");
  });

  it("adding a blank open day to prefilled hours is a no-op (sanitized grid equals baseline)", () => {
    const res = roundTrip(richGym(), (a) => {
      if (a.b_hours.kind === "hours" && a.b_hours.value) {
        a.b_hours.value = { ...a.b_hours.value, wed: ["", ""] };
      }
    });
    expect(res.facts).toEqual([]);
  });

  it("a real hours change on a gym with existing hours is one conflict-flagged fact", () => {
    const res = roundTrip(richGym(), (a) => {
      if (a.b_hours.kind === "hours" && a.b_hours.value) {
        a.b_hours.value = { ...a.b_hours.value, mon: ["05:00", "23:00"] };
      }
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("hours");
    expect(f.conflict).toBe(true);
    expect((f.newValue as Record<string, [string, string]>).mon).toEqual(["05:00", "23:00"]);
    expect(f.newValue).not.toHaveProperty("open_24h");
  });
});

/* ── plans + shared diff helpers used by the trip ─────────────────────── */

describe("round trip — membership plans", () => {
  it("untouched prefilled plans emit nothing; a single price edit emits one plans fact", () => {
    const untouched = roundTrip(richGym());
    expect(untouched.facts).toEqual([]);

    const res = roundTrip(richGym(), (a) => {
      if (a.m_plans.kind === "plans") {
        const price = a.m_plans.value[0].prices.find((p) => p.term === "12_month");
        if (price) price.monthly = 45;
      }
    });
    expect(res.facts).toHaveLength(1);
    const f = res.facts[0];
    expect(f.key).toBe("plans");
    expect(f.target).toEqual({ type: "plans" });
    expect(f.ownerAction).toBe("changed");
    expect(f.conflict).toBe(true); // rewrites an existing plan list
  });
});

describe("diff helpers (the gate the round trip stands on)", () => {
  it("answerEquals: two unanswered answers are equal ('no signal' is not a difference)", () => {
    expect(answerEquals({ kind: "text", value: "  " }, undefined)).toBe(true);
    expect(answerEquals({ kind: "chips", value: [] }, { kind: "chips", value: [] })).toBe(true);
    expect(answerEquals({ kind: "num", value: null }, undefined)).toBe(true);
  });

  it("answerEquals: chips compare as sets; text ignores surrounding whitespace", () => {
    expect(answerEquals({ kind: "chips", value: ["a", "b"] }, { kind: "chips", value: ["b", "a"] })).toBe(true);
    expect(answerEquals({ kind: "text", value: " x " }, { kind: "text", value: "x" })).toBe(true);
    expect(answerEquals({ kind: "chips", value: ["a"] }, { kind: "chips", value: ["a", "b"] })).toBe(false);
  });

  it("sanitizeHours drops blank/partial days and the open_24h flag; all-blank -> null", () => {
    expect(sanitizeHours({ open_24h: true, mon: ["06:00", "22:00"], tue: ["", "17:00"] })).toEqual({
      mon: ["06:00", "22:00"],
    });
    expect(sanitizeHours({ mon: ["", ""] })).toBeNull();
    expect(sanitizeHours(null)).toBeNull();
  });

  it("chipSetDiff splits added / removed / kept", () => {
    expect(chipSetDiff(["a", "c"], ["a", "b"])).toEqual({ added: ["c"], removed: ["b"], kept: ["a"] });
  });
});
