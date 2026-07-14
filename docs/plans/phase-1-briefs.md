# Phase 1 — Worker Briefs (authored by Fable 5, 2026-07-14)

Two waves. Wave A = new components/libs, zero overlap with Phase-0 workers (runs concurrently).
Wave B = integration into GymCard/GymRow and gym/[slug]/page.tsx (runs after the Phase-0 gate
+ Wave A land, because those files are owned by P0 workers W5/W4 until then).
Global worker rules: identical to phase-0-briefs.md.

## Wave A

### A1 — Access status derivation + dual-price DropInCard (P7)
Files: `src/lib/access.ts` (new), `src/lib/access.test.ts` (new), `src/components/gym/AccessBadge.tsx` (new), `src/components/gym/DropInCard.tsx`.
Grounded facts: all fields exist and are nullable — gyms.day_pass_price + week_pass_price
numeric, drop_in_policy (walk_in|book_first|restricted|trial_route|membership_only) +
drop_in_note, monthly_from + monthly_note, guest_policy_model
(public_day_pass|member_invite_only|members_only_waitlist|hybrid) + members_guest_note; all on
EnrichedGym (scout.ts ~214-276). Display vocab exists: DROP_IN_LABELS (scout.ts ~653) and
GUEST_POLICY_LABELS (scout.ts ~206). DropInCard currently returns null when empty (~line 40),
never renders day_pass_price as a fact, and week_pass_price has never rendered publicly.
Build:
1. `deriveAccessStatus(gym) → { label, tone, derivable }` — pure, deterministic, no LLM.
   Precedence: membership_only OR guest_policy_model∈(member_invite_only, members_only_waitlist)
   → "Members' guests only"/"Members only"; walk_in + price → "Walk-in day pass · $X";
   book_first + price → "Book ahead · $X day pass"; trial_route → "Free trial route";
   price w/o policy → "Day pass $X · entry policy unlisted"; day_pass amenity present w/o price
   → "Day passes offered · price unlisted"; nothing derivable → "Access unlisted — call ahead"
   with derivable:false. Policy conflicts (e.g. walk_in + member_invite_only — the Life Time
   case): prefer the restrictive read, and expose the note (members_guest_note/drop_in_note)
   for the detail surface. Vitest coverage for every branch + conflicts.
2. AccessBadge.tsx: compact chip rendering the derived status (tone-coded like existing chips);
   prop `context: 'card' | 'detail'` — cards render nothing when derivable:false (noise
   control at 5% policy coverage); detail always renders, including the call-ahead fallback.
3. DropInCard rework: dual-price layout — Day pass FIRST as a priced fact row (explicit
   "Day pass — unlisted" when null), week pass row (first public render, same unlisted rule),
   membership row second; KEEP the break-even math exactly as-is (do-not-break list); replace
   the return-null with the always-render unlisted layout; surface drop_in_note/
   members_guest_note verbatim when present. Do NOT mount AccessBadge anywhere yet (Wave B).

### A2 — Equipment popular strip + "Show all N" disclosure (P6)
Files: `src/components/gym/AttributeSection.tsx`, `src/components/gym/AttributeOverflowModal.tsx` (new).
Grounded: gym/[slug]/page.tsx renders four AttributeSection groups (Equipment/Recovery/
Training/Facility) ~lines 340-390; AttributeSection owns rows + ProvenanceBadge + FactConfirm
mounts. Long flat lists are the mobile-burial culprit.
Build: AttributeSection gains `collapsedCount` (default ~8, only when items.length > count+2):
render the first N rows (present=true first, highest-confidence first — do not reorder within
those groups otherwise), then a "Show all {items.length} {label}" button in Airbnb's counted
style. The button opens AttributeOverflowModal: full grouped list, same row rendering
(provenance badges + FactConfirm intact — reuse the row renderer, do not fork it), Escape +
backdrop close, body scroll lock, initial focus on the close button (match SignInModal's
existing dialog conventions). No behavior change when item count is small. Keep server/client
split correct: AttributeSection is currently what it is — check whether it's a client
component before adding state; if it's server-rendered, the disclosure lives in a small new
client child, not by converting the whole section.

### A3 — Sticky action bar + Share button components (P5, components only)
Files: `src/components/gym/StickyActionBar.tsx` (new), `src/components/gym/ShareButton.tsx` (new).
Build:
1. ShareButton: "use client"; navigator.share({title, url}) when available, else clipboard
   copy with a 2s "Link copied" state (aria-live="polite"); lucide Share2 icon + label;
   accepts {title, url?} (defaults to current URL); styled like the existing hero action
   buttons (read TrainHereButton/the hero action row for the exact classes).
2. StickyActionBar: "use client"; fixed bottom bar, `lg:hidden` (mobile/tablet only);
   appears after the user scrolls past a sentinel (IntersectionObserver on a ref the page
   will place at the hero's end — export the component so it takes `children` actions plus
   {name, priceLine}); safe-area padding (pb-[env(safe-area-inset-bottom)]); left side =
   gym name (truncated) over a small price/access line; right side = action slot. Respect
   prefers-reduced-motion for its enter transition. Do NOT mount either component (Wave B).

## Wave B (after Phase-0 gate + Wave A)

### B1 — Card hierarchy lock (P1 + P2)
Files: `src/components/gym/GymCard.tsx`, `src/components/gym/GymRow.tsx`.
Lock the 5-fact anatomy: photo (lazy — landed in P0) + segment chip; name; neighborhood +
distance-when-known; price fact with EXPLICIT "Day pass unlisted" state (null renders the
honest state, never nothing — mirrors the map popup's existing rule) or AccessBadge when
derivable; open-now/closes line (already exists — keep); matched-criteria row: when a search
is active, render the parsed criteria as ✓/✗ chips (reasons + missing from the ScoredGym the
card already receives — extend the existing "Why it fits" row rather than replacing it);
equipment hook line for rich-tier gyms (top equipment fact, e.g. "8× racks · Rogue bars").

### B2 — Detail page restructure (P5 integration)
Files: `src/app/gym/[slug]/page.tsx`, plus mounting AccessBadge/ShareButton/StickyActionBar.
Identity strip under the name: segment · neighborhood · AccessBadge(detail) · open-now.
Mobile reorder: Hours + DropInCard (+ParkingCard) hoisted directly under the hero/action row
on <lg (CSS order or conditional duplicate-free layout — restructure the grid, don't render
twice); ShareButton joins the hero action row; StickyActionBar mounted with sentinel after
the hero, actions = Directions (primary) + Save (ShortlistButton) with name + day-pass line.
Verify heading order stays semantic (h1 → h2s). MatchContext (P0/W5) stays directly under the
action row.

## Phase-1 gate (Fable)
tsc/build/vitest; diff review; live walkthrough at 375px: price/access/open-now above the
fold on rich AND sparse gyms; sticky bar appears on scroll, disappears at hero; "Show all N"
keeps provenance + FactConfirm; break-even math untouched; card unlisted states everywhere.
