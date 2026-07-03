import { describe, it, expect } from "vitest";
import { isAnswered, type FieldAnswer, type PlanDraft } from "./answerTypes";

/** Minimal plan draft factory (local — keeps fixtures explicit). */
function plan(over: Partial<PlanDraft> = {}): PlanDraft {
  return {
    name: "",
    usageType: null,
    usageCount: null,
    prices: [{ term: "month_to_month", monthly: null }],
    ...over,
  };
}

describe("isAnswered — missing answer", () => {
  it("undefined (field never rendered/answered) is not answered", () => {
    expect(isAnswered(undefined)).toBe(false);
  });
});

describe("isAnswered — text", () => {
  it("empty string is not answered", () => {
    expect(isAnswered({ kind: "text", value: "" })).toBe(false);
  });

  it("whitespace-only is not answered (a skip, not a signal)", () => {
    expect(isAnswered({ kind: "text", value: "   \t\n " })).toBe(false);
  });

  it("real text is answered, even padded with whitespace", () => {
    expect(isAnswered({ kind: "text", value: "towel service" })).toBe(true);
    expect(isAnswered({ kind: "text", value: "  x  " })).toBe(true);
  });
});

describe("isAnswered — num", () => {
  it("null is not answered (unknown stays unknown)", () => {
    expect(isAnswered({ kind: "num", value: null })).toBe(false);
  });

  it("0 IS answered — an explicit free/zero price is a real signal, not a skip", () => {
    expect(isAnswered({ kind: "num", value: 0 })).toBe(true);
  });

  it("positive number is answered", () => {
    expect(isAnswered({ kind: "num", value: 25 })).toBe(true);
  });
});

describe("isAnswered — tri", () => {
  it("null is not answered (unknown is NOT the same as No)", () => {
    expect(isAnswered({ kind: "tri", value: null })).toBe(false);
  });

  it("explicit true is answered", () => {
    expect(isAnswered({ kind: "tri", value: true })).toBe(true);
  });

  it("explicit false is answered — an owner-attested No is a real signal", () => {
    expect(isAnswered({ kind: "tri", value: false })).toBe(true);
  });
});

describe("isAnswered — choice", () => {
  it("null is not answered", () => {
    expect(isAnswered({ kind: "choice", value: null })).toBe(false);
  });

  it("a selected option is answered", () => {
    expect(isAnswered({ kind: "choice", value: "free_lot" })).toBe(true);
  });
});

describe("isAnswered — chips", () => {
  it("empty array is not answered", () => {
    expect(isAnswered({ kind: "chips", value: [] })).toBe(false);
  });

  it("one chip is answered", () => {
    expect(isAnswered({ kind: "chips", value: ["sauna"] })).toBe(true);
  });
});

describe("isAnswered — hours (audit rule: blank-open day must not count)", () => {
  it("null map is not answered", () => {
    expect(isAnswered({ kind: "hours", value: null })).toBe(false);
  });

  it("empty map is not answered", () => {
    expect(isAnswered({ kind: "hours", value: {} })).toBe(false);
  });

  it('a day toggled "Open" with blank times (["",""]) is NOT answered — would falsely read as open 24h', () => {
    expect(isAnswered({ kind: "hours", value: { mon: ["", ""] } })).toBe(false);
  });

  it("a half-filled day (open time only, or close time only) is NOT answered", () => {
    expect(isAnswered({ kind: "hours", value: { mon: ["06:00", ""] } })).toBe(false);
    expect(isAnswered({ kind: "hours", value: { mon: ["", "22:00"] } })).toBe(false);
  });

  it("ONE complete day is enough — completeness across all 7 days is NOT required (current rule)", () => {
    // Actual rule: some() over days — a single fully-timed day makes the field
    // answered even when other toggled days are still blank.
    expect(
      isAnswered({ kind: "hours", value: { mon: ["06:00", "22:00"], tue: ["", ""] } })
    ).toBe(true);
  });

  it("a fully-specified week is answered", () => {
    expect(
      isAnswered({
        kind: "hours",
        value: { mon: ["05:00", "23:00"], sat: ["07:00", "20:00"], sun: ["08:00", "18:00"] },
      })
    ).toBe(true);
  });

  it("open_24h flag alone does NOT answer the grid — the flag never rides in the grid value by design", () => {
    expect(isAnswered({ kind: "hours", value: { open_24h: true } })).toBe(false);
  });

  it('end-of-day close "00:00" counts as a complete window (non-empty is what matters)', () => {
    expect(isAnswered({ kind: "hours", value: { fri: ["05:00", "00:00"] } })).toBe(true);
  });
});

describe("isAnswered — plans", () => {
  it("empty plan list is not answered", () => {
    expect(isAnswered({ kind: "plans", value: [] })).toBe(false);
  });

  it("a single blank draft row (no name, no prices) is not answered", () => {
    expect(isAnswered({ kind: "plans", value: [plan()] })).toBe(false);
  });

  it("whitespace-only plan name with no prices is not answered", () => {
    expect(isAnswered({ kind: "plans", value: [plan({ name: "  " })] })).toBe(false);
  });

  it("a named plan is answered even before prices are entered", () => {
    expect(isAnswered({ kind: "plans", value: [plan({ name: "Basic" })] })).toBe(true);
  });

  it("an unnamed plan with a price entered still counts as answered (current rule: name OR price)", () => {
    expect(
      isAnswered({
        kind: "plans",
        value: [plan({ prices: [{ term: "month_to_month", monthly: 39 }] })],
      })
    ).toBe(true);
  });

  it("a $0 monthly price is a real signal (0 is not null)", () => {
    expect(
      isAnswered({
        kind: "plans",
        value: [plan({ prices: [{ term: "12_month", monthly: 0 }] })],
      })
    ).toBe(true);
  });

  it("one real plan among blank drafts is answered", () => {
    expect(isAnswered({ kind: "plans", value: [plan(), plan({ name: "Elite" })] })).toBe(true);
  });
});

describe("isAnswered — photo", () => {
  it("no uploads is not answered", () => {
    expect(isAnswered({ kind: "photo", value: [] })).toBe(false);
  });

  it("one uploaded photo is answered (tag optional)", () => {
    const a: FieldAnswer = {
      kind: "photo",
      value: [{ path: "gyms/x/1.jpg", url: "https://cdn.example/1.jpg" }],
    };
    expect(isAnswered(a)).toBe(true);
  });
});
