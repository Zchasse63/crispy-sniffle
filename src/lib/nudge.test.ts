import { describe, it, expect } from "vitest";
import { computeMembershipNudge } from "./nudge";

const gym = { id: "g1", name: "Iron House", day_pass_price: 20, monthly_from: 50 };
const NOW = new Date(2026, 0, 20, 12, 0);
const visit = (daysAgo: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - daysAgo);
  return { gym_id: "g1", visited_on: d.toISOString().slice(0, 10) };
};

describe("computeMembershipNudge", () => {
  it("returns null when prices are unknown", () => {
    expect(computeMembershipNudge([visit(1), visit(2), visit(3)], { ...gym, monthly_from: null }, NOW)).toBeNull();
  });

  it("returns null below the visit threshold (3)", () => {
    expect(computeMembershipNudge([visit(1), visit(2)], gym, NOW)).toBeNull();
  });

  it("returns null when passes still beat the membership", () => {
    // 3 visits * $20 = $60 spent, but membership $100 → passes win, no nudge
    expect(computeMembershipNudge([visit(1), visit(2), visit(3)], { ...gym, monthly_from: 100 }, NOW)).toBeNull();
  });

  it("nudges when spend exceeds the membership across 3+ recent visits", () => {
    const r = computeMembershipNudge([visit(1), visit(5), visit(10)], gym, NOW);
    expect(r).not.toBeNull();
    expect(r!.visitCount).toBe(3);
    expect(r!.spentEstimate).toBe(60);
    // Copy is conditional (we don't know what the user actually paid) — never an
    // unconditional guaranteed-savings claim.
    expect(r!.message).toMatch(/if you paid/i);
    expect(r!.message).not.toMatch(/would save you money/i);
  });

  it("ignores visits older than the trailing 30-day window", () => {
    const r = computeMembershipNudge([visit(1), visit(2), visit(40)], gym, NOW);
    expect(r).toBeNull(); // only 2 recent → below threshold
  });

  it("does not divide by zero / misbehave when day pass is 0", () => {
    // spent = 0, monthly 50 → 0 <= 50 → no nudge, no throw
    expect(() =>
      computeMembershipNudge([visit(1), visit(2), visit(3)], { ...gym, day_pass_price: 0 }, NOW),
    ).not.toThrow();
    expect(computeMembershipNudge([visit(1), visit(2), visit(3)], { ...gym, day_pass_price: 0 }, NOW)).toBeNull();
  });
});
