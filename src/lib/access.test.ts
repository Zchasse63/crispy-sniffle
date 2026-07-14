import { describe, it, expect } from "vitest";
import { deriveAccessStatus, formatPrice, type AccessFields } from "./access";

function makeGym(overrides: Partial<AccessFields> = {}): AccessFields {
  return {
    drop_in_policy: null,
    drop_in_note: null,
    day_pass_price: null,
    guest_policy_model: null,
    members_guest_note: null,
    amenities: [],
    ...overrides,
  };
}

const dayPassAmenity = (present: boolean) => ({
  amenity_key: "day_pass" as const,
  present,
  source: "scraped" as const,
  confidence: 0.85,
  detail: null,
});

describe("formatPrice", () => {
  it("renders whole dollars when the amount is a round number", () => {
    expect(formatPrice(12)).toBe("12");
    expect(formatPrice(12.0)).toBe("12");
  });

  it("renders 2 decimals when the amount has cents", () => {
    expect(formatPrice(12.5)).toBe("12.50");
    expect(formatPrice(9.99)).toBe("9.99");
  });
});

describe("deriveAccessStatus", () => {
  it("branch 8: nothing derivable → unlisted, call ahead, derivable:false", () => {
    const r = deriveAccessStatus(makeGym());
    expect(r).toEqual({ label: "Access unlisted — call ahead", tone: "unknown", derivable: false });
  });

  it("branch 1a: drop_in_policy membership_only → Members only, restricted", () => {
    const r = deriveAccessStatus(makeGym({ drop_in_policy: "membership_only" }));
    expect(r.label).toBe("Members only");
    expect(r.tone).toBe("restricted");
    expect(r.derivable).toBe(true);
  });

  it("branch 1a: note falls back members_guest_note ?? drop_in_note", () => {
    const withMembersNote = deriveAccessStatus(
      makeGym({
        drop_in_policy: "membership_only",
        members_guest_note: "Guests must be sponsored",
        drop_in_note: "ignored",
      }),
    );
    expect(withMembersNote.note).toBe("Guests must be sponsored");

    const fallbackToDropInNote = deriveAccessStatus(
      makeGym({ drop_in_policy: "membership_only", drop_in_note: "Front desk sign-in only" }),
    );
    expect(fallbackToDropInNote.note).toBe("Front desk sign-in only");
  });

  it("branch 1b: guest_policy_model member_invite_only → Members' guests only, restricted", () => {
    const r = deriveAccessStatus(makeGym({ guest_policy_model: "member_invite_only" }));
    expect(r.label).toBe("Members' guests only");
    expect(r.tone).toBe("restricted");
    expect(r.derivable).toBe(true);
  });

  it("branch 1c: guest_policy_model members_only_waitlist → Members only (waitlist), restricted", () => {
    const r = deriveAccessStatus(makeGym({ guest_policy_model: "members_only_waitlist" }));
    expect(r.label).toBe("Members only (waitlist)");
    expect(r.tone).toBe("restricted");
    expect(r.derivable).toBe(true);
  });

  it("conflict (Life Time case): walk_in + member_invite_only → restrictive read wins, note carried", () => {
    const r = deriveAccessStatus(
      makeGym({
        drop_in_policy: "walk_in",
        day_pass_price: 25,
        guest_policy_model: "member_invite_only",
        members_guest_note: "Members may bring guests with advance notice to the front desk",
      }),
    );
    expect(r.label).toBe("Members' guests only");
    expect(r.tone).toBe("restricted");
    expect(r.derivable).toBe(true);
    expect(r.note).toBe("Members may bring guests with advance notice to the front desk");
  });

  it("branch 2: walk_in + day_pass_price → Walk-in day pass · $X, open", () => {
    const r = deriveAccessStatus(makeGym({ drop_in_policy: "walk_in", day_pass_price: 20 }));
    expect(r).toEqual({ label: "Walk-in day pass · $20", tone: "open", derivable: true });
  });

  it("branch 2: walk_in with a non-round price formats with cents", () => {
    const r = deriveAccessStatus(makeGym({ drop_in_policy: "walk_in", day_pass_price: 19.5 }));
    expect(r.label).toBe("Walk-in day pass · $19.50");
  });

  it("branch 2 gap: walk_in with no price and no amenity falls through to unlisted", () => {
    const r = deriveAccessStatus(makeGym({ drop_in_policy: "walk_in" }));
    expect(r.derivable).toBe(false);
    expect(r.label).toBe("Access unlisted — call ahead");
  });

  it("branch 3: book_first + day_pass_price → Book ahead · $X day pass, open", () => {
    const r = deriveAccessStatus(makeGym({ drop_in_policy: "book_first", day_pass_price: 15 }));
    expect(r).toEqual({ label: "Book ahead · $15 day pass", tone: "open", derivable: true });
  });

  it("branch 4: trial_route → Free trial route, open (no price required)", () => {
    const r = deriveAccessStatus(makeGym({ drop_in_policy: "trial_route" }));
    expect(r).toEqual({ label: "Free trial route", tone: "open", derivable: true });
  });

  it("branch 5: restricted → Restricted entry — see notes, note verbatim", () => {
    const r = deriveAccessStatus(
      makeGym({ drop_in_policy: "restricted", drop_in_note: "Corporate members only on weekdays" }),
    );
    expect(r.label).toBe("Restricted entry — see notes");
    expect(r.tone).toBe("restricted");
    expect(r.note).toBe("Corporate members only on weekdays");
  });

  it("branch 5: restricted with no note still labels but note is undefined", () => {
    const r = deriveAccessStatus(makeGym({ drop_in_policy: "restricted" }));
    expect(r.label).toBe("Restricted entry — see notes");
    expect(r.note).toBeUndefined();
  });

  it("branch 6: price-only, no policy on file → Day pass $X · entry policy unlisted", () => {
    const r = deriveAccessStatus(makeGym({ day_pass_price: 10 }));
    expect(r).toEqual({
      label: "Day pass $10 · entry policy unlisted",
      tone: "open",
      derivable: true,
    });
  });

  it("branch 7: amenity-only, no price, no policy → Day passes offered · price unlisted", () => {
    const r = deriveAccessStatus(makeGym({ amenities: [dayPassAmenity(true)] }));
    expect(r).toEqual({
      label: "Day passes offered · price unlisted",
      tone: "open",
      derivable: true,
    });
  });

  it("branch 7 does not fire when the day_pass amenity is present:false", () => {
    const r = deriveAccessStatus(makeGym({ amenities: [dayPassAmenity(false)] }));
    expect(r.derivable).toBe(false);
  });

  it("branch 7 rescues a policy'd gym that's missing a price (walk_in + amenity, no price)", () => {
    const r = deriveAccessStatus(
      makeGym({ drop_in_policy: "walk_in", amenities: [dayPassAmenity(true)] }),
    );
    expect(r.label).toBe("Day passes offered · price unlisted");
    expect(r.tone).toBe("open");
    expect(r.derivable).toBe(true);
  });

  it("null-everything: no policy, no price, no amenity, no guest model → unlisted", () => {
    const r = deriveAccessStatus(makeGym());
    expect(r.derivable).toBe(false);
    expect(r.tone).toBe("unknown");
    expect(r.note).toBeUndefined();
  });
});
