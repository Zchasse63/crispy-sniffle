# Scout — Final Full-Project Audit Charter

You are one of several independent auditors performing the FINAL pre-launch audit of Scout,
an AI-powered gym-discovery web app. Your findings feed the finishing roadmap, so precision
matters more than volume: every finding must cite real code (file:line), state a concrete
failure scenario, and propose a fix. Do NOT modify any files. Read-only. Do not run builds,
tests, or any command that writes. Do not read or print the contents of any file that looks
like a secret or env file.

## What Scout is

- Next.js App Router (RSC; gym detail + city pages force-dynamic) + Supabase
  (Postgres + PostGIS + Auth + Storage + Edge Functions). Deployed on Netlify.
- Catalog: Tampa is the flagship (~747 visible gyms, mixed hand-curated + pipeline-scraped),
  Miami ~40 basic-tier. More metros coming (Miami scale-up to ~1,800 next).
- Core UX: natural-language gym search ("powerlifting gym with sauna open now") → an edge
  function (`supabase/functions/ai-search`) parses language to a FilterSet → a deterministic
  client scorer ranks gyms. Trips/shortlists, community reviews, owner self-serve listing
  claims, and an /admin operator portal.
- HONESTY IS THE PRODUCT: every fact carries provenance (owner > scout_verified > user >
  scraped > seed/osm > estimated) with confidence. Unknown facts render "unlisted", never
  fabricated. Segment labels are soft; equipment is ground truth (the KODAWARI rule).

## Non-negotiable invariants to audit against

1. The FilterSet contract has FOUR surfaces that must stay in sync: rail UI
   (src/lib/stores/filterStore*), fallback parser (src/lib/search/nlParser.ts), edge function
   (supabase/functions/ai-search), scorer (src/lib/scoring/scorer.ts) + synonyms
   (src/lib/search/synonyms.ts). Any drift between them is a P1 finding.
2. Provenance/no-fabrication: nothing may present estimated/inferred data as fact; unknowns
   stay null. Data loaders (scripts/*.mjs) must tag sources honestly.
3. `src/lib/types/database.ts` is HAND-maintained against migrations in supabase/migrations/.
   Enum drift (each enum appears in Row types AND the Constants arrays) is a recurring bug class.
4. hours close time "00:00"/"24:00" means end-of-day; `isOpenNow` in scorer.ts is the single
   source of hours truth.
5. PostgREST returns numerics as wire-strings; every consumer must coerce with Number().

## Scope (audit ALL of it)

- src/ — app routes (public + /admin + /api), components, lib (queries, scoring, search,
  stores, types), proxy.ts (middleware; dev-only in this Next version — verify implications)
- supabase/migrations/*.sql and supabase/functions/ (ai-search edge function)
- scripts/*.mjs — the data pipeline loaders (discover/fetch-pages/land/audit-*/find-emails/
  rehost-photos etc.)
- tests/ + playwright config + any unit test setup — audit the TESTS themselves
- Config: next.config.*, netlify config, package.json, tsconfig

## Focus areas (weight your effort here)

### A. Scale & bulletproofing (highest priority)
Tampa just grew 36 → 747 gyms and immediately exposed a URL-length bug (fixed via chunked
`.in()` in src/lib/queries/gyms.ts). Find the NEXT ceilings before Miami hits ~1,800:
- PostgREST's 1000-row response cap vs any unpaginated `.select()` (e.g. fetchCityGyms,
  admin lists, sitemap.ts, map data) — silent truncation is a P0/P1.
- Client rendering/memory with 747–2,000 gym cards; scorer + Mapbox over the full set.
- Serverless function limits (payload size, timeout) on city/gym pages at this scale.
- Race conditions: zustand persist + skipHydration + HydrationGate/AuthGate ordering,
  tripStore.cloudSync, concurrent admin edits, edge-function per-isolate rate limiting.
- Error handling: what happens when Supabase errors/times out mid-page? Empty vs crash?

### B. Security
- RLS: every public table (gyms, gym_*, facility_candidates, owner_*, community tables,
  profiles) — verify policies exist in migrations and match intent (staff vs public vs owner).
- /admin and /api routes: authentication, authorization (role checks), service-role key usage
  — any path where a non-staff user reaches a service-role write?
- ai-search edge fn: verify_jwt=false BY DESIGN (publishable keys aren't JWTs) with an
  apikey-header gate + 20/min/IP per-isolate rate limit + 300-char cap — assess bypasses,
  prompt-injection into the FilterSet parser, and cost-amplification abuse.
- Auth callback (src/app/auth/callback/route.ts): PKCE exchange + same-origin ?next guard —
  open-redirect attempts.
- Owner invite/claim flow: token generation/hashing/expiry/reuse (owner_invites), the /own/
  [token] surface, photo-upload URL signing.
- Storage buckets: gym-photos (public) vs facility-cache (private) policies; upload abuse.
- XSS surface: any raw-HTML rendering of untrusted strings. Scraped content (gym names,
  descriptions) comes from third-party websites — trace how it is rendered and whether any
  path injects it as HTML rather than text. Scraped photo URLs hotlinked before rehost.
- Secrets hygiene in repo and scripts.

### C. Data integrity
- The four-surface FilterSet contract (see invariants) — diff them key by key.
- scorer.ts: correctness of isOpenNow (overnight hours, "24:00", timezone assumptions —
  gyms are in America/New_York; server may run UTC), price filters vs null prices,
  segment-boost vs equipment-truth (KODAWARI).
- Pipeline loaders: idempotency, partial-failure recovery, dedup logic (place-identity),
  provenance tagging correctness (scraped 0.85 vs estimated 0.65).
- database.ts / scout.ts type mirrors vs actual migrations — find drift.

### D. UI/UX (user-facing quality)
- The 747-gym city experience: list performance, filtering UX, pagination/virtualization
  absence, map clustering, mobile behavior.
- Mixed-quality catalog UX: rich curated gyms next to thin scraped ones (name/address/photo
  only) — is the tiering honest and non-janky? Empty sections? "unlisted" rendering?
- Loading/error/empty states on every route; skeletons; broken-image fallbacks (many scraped
  photo URLs will 404/hotlink-block until rehosted).
- Accessibility: keyboard nav, focus management in modals (they portal to document.body),
  alt text, contrast, ARIA on the filter rail.
- Search UX: latency masking during edge-fn calls, fallback parser parity messaging, zero-
  result handling.
- Trust surfaces: provenance badges, verified badges, claim-your-listing CTA flow.

### E. Testing quality (audit the tests themselves)
- Unit suite (~286 tests) and Playwright e2e (POMs in tests/pages/, specs in tests/e2e/):
  what CRITICAL paths have zero coverage (scoring correctness, FilterSet surfaces, owner
  claim flow, admin moderation, RLS regressions, loaders)?
- Test anti-patterns: over-mocked tests that can't fail, .textContent() on absent elements,
  multi-Page fixtures, missing serial mode on AI-dependent specs, magic sleeps.
- Are the scale bugs (URL-length, 1000-row cap) the kind of thing any existing test would
  have caught? Propose the regression tests that would.

## Severity rubric

- P0 — takes prod down, corrupts/loses data, or is an exploitable security hole.
- P1 — will bite real users at current or imminent scale (Miami ~1,800), or violates a
  non-negotiable invariant.
- P2 — robustness/quality gap that degrades trust or maintainability.
- P3 — polish.

## Required output format (markdown, to stdout)

1. `## Executive summary` — overall verdict + the 10 biggest risks, one line each.
2. `## Findings` — grouped by focus area (A–E). Each finding:
   `- [P0|P1|P2|P3] [confidence: high|med|low] path/to/file:line — finding. FAILURE: concrete
   scenario. FIX: concrete suggestion.`
3. `## What would make this bulletproof` — the missing tests, guardrails, and monitoring you
   would add before calling the project finished, as a prioritized list.

Do not pad. A precise 30-finding report beats a vague 100-finding one. Cite only code you
actually read.
