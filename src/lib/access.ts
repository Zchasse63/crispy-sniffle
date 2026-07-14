import {
  DROP_IN_LABELS,
  GUEST_POLICY_LABELS,
  type EnrichedGym,
} from "@/lib/types/scout";

/**
 * Minimal structural subset of `EnrichedGym` the derivation needs — same
 * `Pick`-off-`EnrichedGym` shape as `CompletenessFields` in `completeness.ts`,
 * so callers with a narrower row type can still satisfy this without a
 * duplicate type import.
 */
export type AccessFields = Pick<
  EnrichedGym,
  | "drop_in_policy"
  | "drop_in_note"
  | "day_pass_price"
  | "guest_policy_model"
  | "members_guest_note"
  | "amenities"
>;

export type AccessTone = "open" | "restricted" | "unknown";

export interface AccessStatus {
  label: string;
  tone: AccessTone;
  /** False only for the final never-fabricate fallback. */
  derivable: boolean;
  /** Verbatim gym-published note, when the branch that fired has one. */
  note?: string;
}

/**
 * Whole dollars when the amount is a round number, otherwise 2 decimals —
 * the same rule DropInCard already applies to `monthly_from`, extracted here
 * so day-pass/week-pass prices use one formatter instead of a third variant.
 */
export function formatPrice(amount: number): string {
  const n = Number(amount);
  return n % 1 === 0 ? n.toFixed(0) : n.toFixed(2);
}

function hasDayPassAmenity(gym: AccessFields): boolean {
  return gym.amenities.some((a) => a.amenity_key === "day_pass" && a.present);
}

/**
 * Deterministic "how do I get in?" status — no LLM, no inference beyond the
 * precedence below. Unknown stays unknown (repo never-fabricate rule):
 * `derivable: false` only on the final fallback.
 *
 * Precedence (first match wins). Restrictive signals are checked FIRST so a
 * conflicting combo — e.g. the documented Life Time case, `walk_in` +
 * `member_invite_only` — reads as restricted rather than walk-in, with the
 * gym's own note carried through:
 *   1. `drop_in_policy === "membership_only"` OR
 *      `guest_policy_model` is `member_invite_only` / `members_only_waitlist`
 *      → "Members only" / "Members' guests only" / "Members only (waitlist)"
 *      (tone `restricted`; note = members_guest_note ?? drop_in_note)
 *   2. `walk_in` + day_pass_price   → "Walk-in day pass · $X" (`open`)
 *   3. `book_first` + day_pass_price → "Book ahead · $X day pass" (`open`)
 *   4. `trial_route`                → "Free trial route" (`open`)
 *   5. `restricted`                 → "Restricted entry — see notes"
 *      (`restricted`; note = drop_in_note verbatim)
 *   6. day_pass_price, no policy on file → "Day pass $X · entry policy
 *      unlisted" (`open`)
 *   7. `day_pass` amenity present, no price → "Day passes offered · price
 *      unlisted" (`open`)
 *   8. else → "Access unlisted — call ahead" (`unknown`, `derivable: false`)
 */
export function deriveAccessStatus(gym: AccessFields): AccessStatus {
  const { drop_in_policy, drop_in_note, day_pass_price, guest_policy_model, members_guest_note } = gym;

  // 1. Restrictive signals dominate conflicts.
  if (drop_in_policy === "membership_only") {
    return {
      label: DROP_IN_LABELS.membership_only,
      tone: "restricted",
      derivable: true,
      note: members_guest_note ?? drop_in_note ?? undefined,
    };
  }
  if (guest_policy_model === "member_invite_only" || guest_policy_model === "members_only_waitlist") {
    return {
      label: GUEST_POLICY_LABELS[guest_policy_model],
      tone: "restricted",
      derivable: true,
      note: members_guest_note ?? drop_in_note ?? undefined,
    };
  }

  // 2. Walk-in with a published day-pass price.
  if (drop_in_policy === "walk_in" && day_pass_price !== null) {
    return { label: `Walk-in day pass · $${formatPrice(day_pass_price)}`, tone: "open", derivable: true };
  }

  // 3. Book-ahead with a published day-pass price.
  if (drop_in_policy === "book_first" && day_pass_price !== null) {
    return {
      label: `Book ahead · $${formatPrice(day_pass_price)} day pass`,
      tone: "open",
      derivable: true,
    };
  }

  // 4. Trial-route gyms funnel drop-ins through a free trial instead of a day pass.
  if (drop_in_policy === "trial_route") {
    return { label: "Free trial route", tone: "open", derivable: true };
  }

  // 5. Explicitly restricted entry — point to the gym's own note, don't guess why.
  if (drop_in_policy === "restricted") {
    return {
      label: "Restricted entry — see notes",
      tone: "restricted",
      derivable: true,
      note: drop_in_note ?? undefined,
    };
  }

  // 6. Price published but no policy on file.
  if (drop_in_policy === null && day_pass_price !== null) {
    return {
      label: `Day pass $${formatPrice(day_pass_price)} · entry policy unlisted`,
      tone: "open",
      derivable: true,
    };
  }

  // 7. The day_pass amenity is flagged present but we don't have a price.
  if (day_pass_price === null && hasDayPassAmenity(gym)) {
    return { label: "Day passes offered · price unlisted", tone: "open", derivable: true };
  }

  // 8. Nothing to go on — never fabricate, say so plainly.
  return { label: "Access unlisted — call ahead", tone: "unknown", derivable: false };
}
