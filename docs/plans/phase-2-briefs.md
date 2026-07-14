# Phase 2 — Worker Briefs (authored by Fable 5, 2026-07-14)

Wave 1 (parallel, disjoint): W-P2-discovery, W-P2-compare, W-P2-toast.
Wave 2 (after Wave-1 gate): W-P2-a11y systemic pass over the merged tree.
Deferred to Phase 2b (needs migrations, Fable applies via Supabase MCP): saved filter
sets (`saved_filter_sets` table) and any schema-touching polish.
Global worker rules: identical to phase-0-briefs.md.

## W-P2-discovery — sort control, value rails, applied chips, facet counts, mobile badge (P3+P4)
Files: src/stores/filterStore.ts, src/components/discovery/DiscoveryClient.tsx,
src/components/filters/FilterRail.tsx, src/lib/scoring/scorer.ts, src/lib/travel.ts,
src/lib/types/scout.ts, plus up to two NEW components under src/components/discovery/
(AppliedFilterChips.tsx, BrowseRails.tsx).
Grounded constraints (verified against code):
- Sort lives OUTSIDE FilterSet (TravelFilter precedent, filterStore.ts:7-15) — display-side
  re-sort AFTER scoreGyms. NO nlParser/edge/ai-search changes (four-surface contract stays
  untouched).
- NO rating sort — rating is NULL for all 836 prod gyms.
- Price sort: nulls-last + honest coverage label ("97 of 747 list a price").
- Distance sort: add haversine to lib/travel.ts; use travel.origin when Near-Me active,
  else disabled state with hint (reuse NearMeFilter's degradation pattern).
- Weak-match banner (DiscoveryClient.tsx:66-103) and search_logs telemetry (line ~59,
  scored[0]) MUST keep reading the MATCH-sorted array, never the display-sorted one.
- Facet counts: extract the hard-exclusion predicate from scoreGyms (scorer.ts:74-97) into
  an exported function used by BOTH scoring and counting (one implementation). Counts are
  FACET counts ("34 listed") — amenity/equipment filters RANK, they don't exclude; copy
  must not imply the result count will drop. Count only present=true (never-fabricate);
  reuse hasAmenity for open_24h. Compute once in DiscoveryClient, pass to both FilterRail
  instances (it renders twice: desktop aside + mobile sheet). Zero-count options: gray,
  never disabled.
- Applied chips: enumerate every active FilterSet member + a travel chip
  (filterStore.travel, clears via setTravel(null)); soft segments/vibes styled dashed per
  the "~" convention; per-chip removal via the established getState() patch pattern; keep
  the existing rawQuery pill and Clear-all.
- Mobile badge: countActiveFilters(filters, travelActive) added NEXT TO isEmptyFilterSet in
  scout.ts (lockstep); count pill on the Filters button (DiscoveryClient.tsx:178-184).
- Value rails on the EMPTY-filter browse state only: "Open now" (patch openNow),
  "Cheapest day passes" (sortBy price), "Best equipped" (sort by shared completeness/
  equipment count with honest label). Chips row styled like SegmentIconRow.

## W-P2-compare — compare interaction rebuild (audit #6 + P10-C)
Files: src/app/compare/page.tsx, src/components/compare/CompareTable.tsx,
src/lib/queries/gyms.ts (add fetchGymsBySlugs), plus ONE new client component if needed
(ComparePicker.tsx).
Grounded problems (all confirmed): page slices savedIds[0..3] with no picker; "Remove"
permanently deletes the shortlist save; only hours signal is a 24h boolean though
EnrichedGym.hours + isOpenNow exist; sticky column headers broken (code comment at
CompareTable.tsx:77-78 admits it); no conversion actions; week_pass_price (scout.ts:226)
and distance data never render.
Build:
1. PICKER: when >3 saved, a chip row above the table listing all saved gyms; tap toggles
   inclusion (max 3 selected, oldest auto-deselects); selection is page-local state
   (default = first 3). Remove-from-compare = deselect. NEVER touches shortlistStore.
2. Non-destructive: kill the store-mutating Remove column control entirely (deselect
   replaces it); update the page copy that coaches removal.
3. New rows in the top decision band: Hours/open-now (render openStatus label per gym,
   server-computable? page is client — check how it fetches; use the same convention as
   GymCard), Week pass (explicit unlisted), Distance/address line (neighborhood + address;
   no geolocation dependency).
4. Per-column actions row (top, under the gym name): "View gym" link + Directions link
   (same maps URL convention as gym detail) — small icon buttons.
5. Fix vertical sticky headers: the documented approach failing at :77-78 — restructure so
   the name row actually sticks (position sticky needs the scroll container + top offset
   right; test with 40+ rows).
6. SHAREABLE URL: accept ?gyms=slug1,slug2,slug3 (cap 3, validate against fetch results,
   read-only — a shared link must NOT mutate the visitor's shortlist); add
   fetchGymsBySlugs (order-preserving, mirror fetchGymsByIds at gyms.ts:274-285); a Share
   button (reuse components/gym/ShareButton with the compare URL) that encodes current
   selection; OG metadata for the route ("Compare: A vs B vs C — Scout").

## W-P2-toast — feedback layer: toast system, post-save nudge, destructive confirms
Files: src/components/ui/Toast.tsx (new), src/app/layout.tsx (mount provider),
src/components/shortlist/ShortlistButton.tsx, src/components/shortlist/ShortlistDrawer.tsx,
src/components/trips/TripCard.tsx.
Build:
1. Minimal toast system — no deps: a tiny zustand store + portal renderer (bottom-center,
   above the sticky bar z-index — check StickyActionBar's z-40 and go z-50), aria-live
   ="polite" region, auto-dismiss 4s, max 2 stacked, optional action link + optional Undo
   callback, motion-safe transitions. Export toast() helper.
2. ShortlistButton: on SAVE show "Saved · {n} gyms — Compare →" (action → /compare) once
   n ≥ 2, else "Saved to shortlist"; on UNSAVE show "Removed — Undo" (Undo re-toggles).
   Read count from the store at event time (getState pattern).
3. ShortlistDrawer per-row remove: same Undo toast.
4. TripCard delete: replace the instant delete with a confirm step (inline two-step button
   "Delete trip? Confirm" pattern used elsewhere OR a small confirm dialog matching modal
   conventions) + an Undo toast after deletion (re-addTrip with the same data incl.
   lodging — read tripStore's shape first; cloudSync fires on re-add, acceptable).
5. Don't toast on compare deselect (that's non-destructive now).

## W-P2-a11y (Wave 2, after gate) — systemic accessibility pass
Files: broad but additive — SiteHeader.tsx, app/layout.tsx (skip link target), the six
overlays (SignInModal, AddTripModal, ShortlistDrawer, Lightbox, AttributeOverflowModal,
DiscoveryClient mobile sheet), ProvenanceBadge.tsx, DataTierBadge.tsx, MatchBadge.tsx,
AttributeSection.tsx, filters components (touch targets), community/FactConfirm.tsx,
plus one new src/lib/useFocusTrap.ts.
Build:
1. useFocusTrap(ref, active): Tab/Shift-Tab wrap, restore focus to opener on close; apply
   to all six overlays (verify each still closes on Escape + backdrop; Lightbox must
   receive initial focus — it currently never does).
2. Skip link: visually-hidden-until-focused "Skip to results/content" as first tab stop in
   layout; give main content containers id + <main> landmarks where missing (gym detail
   page uses a plain div — check what wave B left and add <main> there and on /compare,
   /trips, /me if absent).
3. aria-live: result-count + parse-state announcements in DiscoveryClient (polite),
   auth errors in SignInModal (role=alert exists? verify), FactConfirm confirmation.
4. Touch targets ≥44px: header bookmark + auth buttons (SiteHeader), FilterRail steppers,
   NearMeFilter chips, FactConfirm buttons — bump hit areas via padding/min-h/min-w
   without visually inflating (negative-margin hit-area technique where needed).
5. Badge meaning on touch: ProvenanceBadge/DataTierBadge/MatchBadge title= tooltips become
   tap-to-toggle popovers (click/Enter opens a small dismissible note; keep title for
   pointer users); ensure aria-describedby wiring.
6. SR has/hasn't semantics: AttributeSection rows get visually-hidden "has"/"does not
   list" prefixes (or aria-label on the row) so present/absent isn't icon-only.
7. prefers-reduced-motion: audit remaining bare animate-* (OwnerFormShell:314 flagged).

## Phase-2 gate (Fable)
tsc/build/vitest + eslint on touched files; axe-style manual pass (keyboard-only journey:
search → filter → sort → card → detail → save → compare → share URL cold-load); live
walkthrough of sort/chips/counts/toasts/confirms at desktop + 375px; verify weak-match
banner + search_logs still read match order; verify shared compare URL in a fresh
private window doesn't mutate the shortlist.
