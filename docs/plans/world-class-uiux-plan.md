# Scout — World-Class UI/UX Plan (July 2026)

> Output of the July 14, 2026 full UI/UX audit (95 agents: 12 surface audits, 7 competitor
> briefs, 75 adversarial verifications, live desktop+mobile walkthrough) plus a 9-agent
> code-grounding pass that verified every pattern against this codebase.
> Audit report artifact: https://claude.ai/code/artifact/b34aab1e-aeb9-459a-baa2-fc1cf03da044
>
> **Verdict:** strong B+. The extraordinary core (provenance-badged honest data, explainable
> matching) is buried behind ordinary or broken entry states. Three systemic themes explain
> ~80% of findings: (1) scale outran the UI, (2) the decision hierarchy inverts exactly where
> decisions happen, (3) every flow dead-ends at its handoff.

## Execution model (agreed 2026-07-14)

- **Fable 5** authors all plans and task briefs, and performs final verification/review.
- **Sonnet** workers execute well-specified implementation briefs (token-spend management).
- Briefs live beside this plan (`phase-0-briefs.md`, etc.) as the delegation record.
- Repo rule #1 always applies: "done" = executed and observed, never files-written.

## Competitor-pattern decisions

"Core" = the four contracts: FilterSet four-surface contract (rail ↔ nlParser ↔ ai-search
edge fn ↔ scorer, one commit); deterministic explainable scoring (LLM parses only);
provenance ladder / never-fabricate; one implementation per concern.

| # | Pattern (source) | Core impact | Effort | Decision |
|---|------------------|-------------|--------|----------|
| P1 | Card hierarchy lock — 5-fact card + explicit "Day pass unlisted" (Airbnb/ClassPass) | none | S–M | **Adopt** (Phase 1) |
| P2 | Matched-criteria ✓/✗ on cards + match panel on detail (Yelp/Google) | none | S–M | **Adopt** (Phase 1; detail panel seeded in Phase 0) |
| P3 | Sort control + value rails + honest ranking label (Booking/Google/Mindbody) | additive (sort lives OUTSIDE FilterSet — TravelFilter precedent) | M | **Adopt** (Phase 2). NO rating sort — rating is NULL for all 836 prod gyms |
| P4 | Applied-filter chips + facet counts + mobile badge + saved sets (Booking) | additive; saved sets = new table | M | **Adopt** (Phase 2). Counts are facet counts ("34 listed"), filters RANK not exclude. Saved sets = explicit recall only (filterStore.ts:31 deliberately rejects silent restore) |
| P5 | Detail restructure: identity strip, mobile reorder, docked action row + sticky rail (GMaps/OpenTable/Airbnb) | none | M | **Adopt** (Phase 1) |
| P6 | "Show all N" equipment disclosure + popular strip (Airbnb/Booking) | none | S | **Adopt** (Phase 1) |
| P7 | Access-status badge + dual-price DropInCard (Wellhub/Hussle) | additive — pure deriveAccessStatus(); schema ~90% exists | M | **Adopt** (Phase 1) + data-backfill workstream (Phase 4) — only 5% of Tampa gyms have drop_in_policy, 13% have day_pass_price |
| P8 | Price context bands (Google Hotels) | additive | M | **Adopt later** (Phase 5) — data-gated: only yoga (n=45) and boutique (n=22) clear n≥20; a metro band today would be dishonest |
| P9 | Map clustering + rank-limited price pins + split view (Airbnb/ClassPass) | none | M | **Adopt** (Phase 3) — required pre-Miami |
| P10 | Save-as-subscription + shareable compare/trips (Resy) | additive | S share / L alerts | Shareable compare **now** (Phase 2). Alert capture Phase 4; **delivery gated** on verified email domain + scheduler + gym_edit_log loader instrumentation + unsubscribe flow |
| P11 | Trips as container — save-to-trip, /trips/[id], at-the-door, open-during-stay (Airbnb) | **data-model**: cloud_trips.gym_ids uuid[]; merge.ts cloud-wins → array-union | L | **Adopt** (Phase 4) |
| P12 | Freshness stamps + confirm/flag loop (OpenTable/GymMaps) | additive | M | **Adopt** (Phase 4). HARD GATE: touch triggers must land before any "verified Nd ago" renders (current timestamps are first-write dates — showing them would fabricate recency). Admin corrections queue ships in the same phase (flags currently go to a black hole) |
| P13 | Ask Scout — grounded Q&A (OpenTable Concierge/Ask Maps) | **expands LLM role** — constitution amendment | M | **Adopt, final phase, pending ratification.** Design: separate ask-gym edge fn; LLM outputs fact IDs ONLY; server derives verdicts from DB + templated rendering; deterministic chips; CLAUDE.md rule 6 amended in same commit |
| P14 | City switcher + /city pages + geo-IP (ClassPass/Mindbody) | **touches FilterSet contract** (per-city neighborhood vocab across all 4 surfaces + edge redeploy, one commit) | L | **Adopt** (Phase 3). Needs cities.is_live gate (8 placeholder metros). Geo-IP via x-nf-geo in RSC (middleware emits no prod bundle). Hide neighborhood filter for basic-tier cities (Miami values are municipalities; 17/40 rows are "Miami") |
| P15 | Reviews system — verified visits, subscores (Airbnb/Mindbody/Hussle) | data-model + moderation cost | XL | **Defer** — 0 reviews / 0 ratings in prod; FactConfirm loop (P12) is the better trust wedge at this scale |

## Phases

### Phase 0 — Integrity quick wins (2–3 days) → briefs in `phase-0-briefs.md`
1. loading.tsx for /, /gym/[slug], /me, /trips, /compare (skeleton components exist as dead code).
2. `loading="lazy"` on GymCard images.
3. Completeness-first default sort tiebreak (extract shared completeness() from admin lib; replace dead byRatingThenName; update scorer.test.ts same commit).
4. Owner portal trust triage: kill prototype success copy; dedicated expired/used-token screen; optional contact field on short path; honest post-submit review (read-only + correction route).
5. Auth round-trip: ?next= on magic links (callback guard already exists); resume pending Train-Here action; router refresh on sign-out.
6. Sign-in modal value pitch; match context panel on gym detail (recompute deterministically from current FilterSet — replaces the matchScore-nulled-at-line-191 dead end).
7. global-error.tsx; /contact page; replace all personal-Gmail mailtos.
- **Gate:** tsc + build + vitest green; dev-server walkthrough of each change; Fable review of full diff.

### Phase 1 — The decision layer (week 1–2) — P1, P2, P5, P6, P7
Card lock (5 facts + unlisted states + ✓/✗ criteria + equipment hook); detail identity strip;
mobile section reorder (Hours + DropInCard under hero); docked mobile action row + desktop
sticky rail; Share button (OG already wired); access badge (`src/lib/access.ts`, precedence
rules for the Life Time conditional-guest conflict); dual-price DropInCard (day pass first,
first-ever week_pass_price render, explicit unlisted rows); equipment popular strip +
counted "Show all N" modal with per-fact provenance.
- **Gate:** mobile walkthrough — price/access/open-now above the fold; CTA reachable at any depth.

### Phase 2 — Control & flow repair (week 2–3) — P3, P4, compare rebuild, feedback, a11y
Sort control (sortBy OUTSIDE FilterSet; nulls-last + coverage labels; keep weak-match banner
and search_logs reading MATCH order); value rails on browse; AppliedFilterChips (incl. travel
chip) + facet counts (extract scorer hard-filter predicate — one implementation) + mobile
badge + saved-sets table (explicit recall; sanitizeFilterSet + version field; HydrationGate
Promise.all ordering); compare rebuild (picker, non-destructive remove, hours/open-now +
distance + week-pass rows, per-column CTAs, fixed sticky headers, shareable ?gyms= URL +
OG); toast system + post-save compare nudge; confirmations on destructive actions; a11y
systemic pass (focus traps/return in all 5 overlays, aria-live, 44px targets, badge
tooltips → tappable popovers, skip link, main landmarks, SR has/hasn't semantics).
- **Gate:** keyboard-only journey; axe pass; share-link cold load.

### Phase 3 — Scale & reach (week 3–4) — P14, P9, perf, admin
cities.is_live migration; header CitySwitcher; /city/[slug] + de-hardcoded Tampa copy (~15
sites); per-city NEIGHBORHOOD_SYNONYMS — THE four-surface change + full edge redeploy in one
commit; basic-tier neighborhood filter hidden; geo-IP (x-nf-geo, cookie override);
DataTierBadge on browse; sitemap city URLs; map clustering + rank-limited price pins +
desktop split view with hover sync; 24-card incremental render (watch PostgREST 1000-row
silent truncation pre-Miami-scale-up); admin: queues-first dashboard + badge counts,
per-field provenance guard in inspector (fix PROVENANCE_META ranking scout_verified above
owner — contradicts spec), gym-table pagination; public "claim your gym" page.
- **Gate:** Miami browsable end-to-end; front door <1MB document, LCP <2.5s.

### Phase 4 — The loop (week 4–6) — P11, P12, P10 capture, data backfill
Trips: gym_ids uuid[] on cloud_trips (+ database.ts/scout.ts mirrors same commit); merge.ts
array-union; gym_ids synced via dedicated op only (addTrip upsert payload would clobber);
save-to-trip prompt (matching city only); /trips/[id] keyed on city+dates tuple (ids diverge
across local/cloud); at-the-door block (parking.ts + Matrix minutes + isOpenNow all exist);
open-during-stay post-score re-rank, unknown-hours-neutral.
Freshness, strictly ordered: (a) timestamp-integrity migration (touch triggers:
fact_confirmations, gym_amenities; updated_at on gym_equipment; gyms.hours_verified_at +
day_pass_verified_at stamped by publish route AND loaders); (b) confirmation_counts RPC
rebuild (DROP+recreate+re-grant — return type changes) adding last_confirmed_at + 7-day
counts; (c) mount FactConfirm on HoursDisplay + DropInCard (component + DB constraint
already accept price/hours); (d) tier-honest wording ("confirmed by a member 3d ago" ≠
"owner-verified"); (e) admin corrections queue same phase.
Subscription capture: ShortlistButton live cloud-sync to followed_gyms (saves currently
never sync until next sign-in merge); post-save alert opt-in; resolve save-vs-follow
conflation; email_subscribers unsubscribe columns + route BEFORE any send.
Data backfill: enrich/land loaders extract drop_in_policy / guest_policy_model /
day_pass_price — stated facts only → scraped 0.85; inferences → estimated ≤0.7.
- **Gate:** two-device trip sync (union, no clobber); stamps show only post-trigger dates; a flagged fact reaches the admin queue.

### Phase 5 — Moat surfaces (week 6+, gated)
Ask Scout (after ratification): ask-gym edge fn (copied scaffolding, tighter rate limit,
answer cache keyed gym+normalized question); {fact_ids} output contract; server-derived
verdicts + template registry + real ProvenanceBadge inline; deterministic chips from facts
the gym HAS; ask_logs; CLAUDE.md rule 6 amendment same commit; serial-mode e2e.
Price bands: auto-unlocks at ≥2–3 segments n≥20 post-backfill; segment cohorts; "of listed
prices" copy; Miami suppressed; rounded bands.
Alert delivery: when domain verifies — loader instrumentation of gym_edit_log, scheduler
(pg_cron or Netlify scheduled fn), digest template + send log, provenance-aware dedupe
(never alert on estimated flapping).

## iOS / native track commitments (post-Phase-5 — locked by Zach, 2026-07-14)

**Calendar-driven trip recommendations** (owner-flagged as an important feature):
the native app must integrate the device calendar (EventKit, permission-gated) to
DETECT upcoming travel — flights, hotel stays, out-of-town events — and proactively
suggest a Scout trip for those dates + destination, feeding the same recommendation
engine that already ships on web. The web foundations are BUILT and shipped
(Phase 4): trips carry dates; `openDuringStay` ranks recommendations by the user's
actual stay days; lodging → drive-time re-ranking; save-to-trip prompts. iOS adds
the detection layer on top — no rework of the engine required. Precursor candidates
for web before iOS: .ics calendar-export of planned gym visits from a trip, and a
"paste your travel dates" quick-create. Do not ship the iOS beta without the
calendar detection feature scoped.

## Standing rules (every phase)
- **Do-not-break regression list:** weak-match relax chips; three-state honesty rendering;
  "Why it fits" reasons; DropInCard break-even math; lodging→drive-time trip re-ranking;
  owner prefill-and-confirm; mobile filter bottom sheet; admin submission diff view.
- Migrations: apply via Supabase MCP → mirror into supabase/migrations/ → database.ts +
  scout.ts in the same commit. Any FilterSet change = all four surfaces + synonyms.ts +
  full-content edge redeploy, one commit.
- Never fabricate: unknown renders "unlisted"; estimates badge ≤0.7; counts only
  present=true.

## Decision log (resolved by Zach, 2026-07-14)
1. **Ask Scout LLM-role amendment: RATIFIED.** P13 proceeds in Phase 5 with the fact-ID-selection
   guardrail (LLM outputs fact IDs only; server derives verdicts + templated rendering).
   CLAUDE.md rule 6 amended in the same commit that ships it.
2. **Email domain: Zach is handling verification.** Alert *delivery* (P10-B) stays gated until the
   domain verifies; everything up to the send (capture, unsubscribe schema, edit-log
   instrumentation, digest template) is built so delivery is a flip, not a project.
3. **Miami: gets its own enrichment pass** (added to Phase 3 as workstream 3.0). The city
   switcher may ship first with Miami hidden behind `cities.is_live`; Miami flips live only
   after its enrichment pass (enrich → geocode → parking-enrich → decision-enrich loaders on
   its live gyms) completes and is verified.

**Execution mandate (2026-07-14):** work through all phases to 100% completion autonomously.
Per-phase cycle: Fable authors briefs → Sonnet workers implement → Fable gate (tsc/build/tests,
diff review, live walkthrough) → commit. Phase-gate deploys follow the repo norm (push to main
→ Netlify → verify live).
