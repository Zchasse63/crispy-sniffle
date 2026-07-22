I'll perform a read-only final audit against the charter invariants, starting with project structure and the highest-risk scale, security, and FilterSet surfaces.Reading the highest-risk surfaces in parallel: queries, FilterSet contract, scorer, auth, and edge functions.Continuing with types, discovery rendering, auth/admin security, and remaining scale paths.Digging into scale ceilings, RLS, owner flows, and remaining unpaginated queries.Investigating admin list queries, owner security, RLS policies, and type/enum drift.Checking dual hours implementations, type/enum drift, hydration races, and test coverage gaps.Probing child-table pagination ceilings, overnight hours edge cases, RLS gaps, and test anti-patterns.Checking a few more high-severity paths: child-row truncation math, RSC payload size, photo fallbacks, and open write policies.Confirming gym-detail full-city fetch, overnight hours edge case, and a few remaining security surfaces.Verifying a few precise line citations for the highest-severity findings.Checking a few more concrete failure points for precise citations.## Executive summary

**Verdict: launch-viable for Tampa beta with honesty/security foundations in good shape, but not scale-safe for Miami ~1,800 without fixing silent PostgREST truncation and full-catalog RSC payloads.** FilterSet keys are currently in lockstep (154 equipment / 11 segments); provenance ladder, owner quarantine, staff gates, and durable LLM spend controls are real. The next outages will come from **unpaginated selects**, **child-join 1000-row caps**, and **shipping entire city graphs to the browser** — not from FilterSet drift.

**Top 10 risks**
1. Child joins (`gym_equipment` etc.) chunk IDs but not response pages → silent equipment truncation past ~1k rows/chunk.
2. `sitemap.ts` unpaginated gym select → SEO silently drops gyms once live catalog >1000.
3. Admin `listGymsForAdmin` / `getDataQuality` unpaginated → wrong operator dashboards past 1000.
4. Every gym detail loads the **entire city** just for 4 “similar” cards.
5. City page `generateMetadata` + page each call `fetchCityGyms` → 2× full-city work per request.
6. Discovery/Trips ship full enriched catalogs client-side (RSC payload + client memory at 1.8k).
7. `GymCard` hardcodes neighborhood fallback `"Tampa"` → fabricates location off-Tampa.
8. List cards have no broken-image fallback (gallery does) → janky scraped-photo UX at scale.
9. Open `search_logs` / `ask_logs` insert policies → cheap telemetry spam / DB bloat.
10. No regression tests for 1000-row caps, join chunking, or FilterSet surface parity — the last scale bug class won’t be caught again.

---

## Findings

### A. Scale & bulletproofing

- **[P1] [confidence: high] `src/lib/queries/gyms.ts:173-187,193-204` — `chunkedIn` only chunks the `.in(gym_id)` list (50 IDs), not the response.** PostgREST still silently caps each response at 1000 rows. FAILURE: 50 rich gyms × ~25 equipment rows ≈ 1,250 rows → last ~250 equipment facts dropped with no error; “has platform / Rogue” scoring and cards go false-negative. FIX: page each chunk with `.range()` until short page, or shrink `IN_CHUNK` adaptively and assert `data.length < 1000` (throw/retry if equal).

- **[P1] [confidence: high] `src/app/sitemap.ts:10-16` — bare `.from("gyms").select(...)` with no `.range()`.** FAILURE: when live gyms exceed 1000 (Tampa 747 + Miami scale-up), sitemap omits arbitrary tail slugs; Google never learns those URLs. FIX: same pagination loop as `fetchCityGyms` (stable `order("slug").range`).

- **[P1] [confidence: high] `src/lib/admin/gyms-admin.ts:51-54,105-108` — admin master list and data-quality cockpit use unpaginated `select("*")` on gyms + full amenity/equipment tables.** FAILURE: past 1000 gyms (or tens of thousands of fact rows), operators see truncated completeness/provenance mixes and miss suspect listings. FIX: page gyms; aggregate facts via SQL `group by source` / `count(*) filter` RPCs instead of shipping every row.

- **[P1] [confidence: high] `src/app/gym/[slug]/page.tsx:218-222` — detail page calls `fetchCityGyms` solely to pick 4 same-segment neighbors.** FAILURE: every detail view pays full-city multi-roundtrip cost (gyms pages + 4× chunked child joins). At Miami ~1800 this multiplies serverless time/egress and risks timeouts under concurrency. FIX: `select` same `city_id`+`segment` with `.neq("id").limit(4)` (or a tiny RPC), never the full catalog.

- **[P1] [confidence: high] `src/app/city/[slug]/page.tsx:25,45` — `generateMetadata` and the page each invoke `fetchCityGyms`.** FAILURE: one city hit does two full enriched loads (metadata only needs city row + counts). FIX: `fetchCity` for metadata; single `fetchCityGyms` in the page (or React `cache()` wrapper).

- **[P1] [confidence: med] `src/app/page.tsx:70` + `src/components/discovery/DiscoveryClient.tsx:35-40,90` — full `EnrichedGym[]` is RSC-serialized and re-scored client-side on every filter keystroke.** FAILURE: at 1.8k gyms × amenities/equipment/parking, HTML/flight payload and main-thread `scoreGyms`/`pointInPolygon` grow linearly; low-end mobile stutters even with `CARDS_PER_PAGE=24` (map still gets full set). FIX: slim list DTO (id/slug/name/coords/prices/segment/open flags + key amenity bits); keep heavy joins for detail; consider server-side prefilter for hard gates.

- **[P2] [confidence: high] `src/components/trips/TripCard.tsx:47-53` and `TripDetail.tsx` — each trip card client-fetches the entire city catalog.** FAILURE: `/trips` with 3 Tampa trips ≈ 3× full-city browser downloads; Mapbox Matrix is already chunked, but Supabase isn’t memoized across cards. FIX: one shared city fetch per slug (SWR/context) or server-load trip destinations by `gym_ids` only.

- **[P2] [confidence: high] `src/lib/queries/gyms.ts:318-328` — `fetchGymsByIds` / `fetchGymsBySlugs` use unchunked `.in()`.** FAILURE: a long compare/shortlist/share URL with many IDs hits the same URL-length 400 that city joins already fixed. FIX: reuse `chunkedIn` (and page if needed).

- **[P2] [confidence: med] `proxy.ts:4-6,37-39` + `src/lib/supabase/server.ts:17-24` — prod middleware manifest is empty; RSC cookie `setAll` is swallowed.** FAILURE: server components can see a stale/expired session while the browser still looks signed-in until client refresh runs; intermittent “signed-out” flashes on `/me` and staff layout. FIX: Netlify edge middleware for cookie refresh, or accept client-only session and stop relying on RSC auth for UX-critical paths.

- **[P2] [confidence: med] `src/app/page.tsx` / city/gym routes — no local try/catch around Supabase; only root `error.tsx`.** FAILURE: a PostgREST timeout mid-`fetchCityGyms` becomes a generic error boundary, not a retry/degraded empty state with “Scout can’t reach the catalog.” FIX: catch at page level → friendly empty + retry; log status codes.

### B. Security

- **[P1] [confidence: high] `supabase/migrations/20260611030001_search_logs.sql:13-14` and `20260714200001_ask_logs.sql` — `insert … with check (true)` for anon.** FAILURE: anyone with the publishable key can flood `search_logs`/`ask_logs` (and abuse was partially fixed for LLM spend, not telemetry). FIX: rate-limit via edge/RPC, require captcha/session, or insert only through a gated function.

- **[P2] [confidence: high] `supabase/functions/ai-search/index.ts:16-18,235-237` — CORS `*` and auth = presence of any `apikey` header (public publishable key).** FAILURE: third-party sites can burn the daily LLM budget up to `AI_SEARCH_DAILY_CAP` (5000) per day; durable `llm_gate` contains cost but not intentional drain-to-cap. FIX: origin allow-list on the edge fn, tighter daily cap + anomaly alerts, optional signed short-lived client tokens.

- **[P2] [confidence: high] `src/lib/owner/guard.ts:27-32` — empty origin allow-list fails open.** FAILURE: if `NEXT_PUBLIC_SITE_URL`/`URL` unset on a deploy, CSRF origin checks no-op; token still required, but cross-site browser POSTs with a leaked invite become easier. FIX: fail closed in production when allow-list is empty.

- **[P2] [confidence: med] `next.config.ts:10-16,23` — CSP allows `script-src 'unsafe-inline'` because prod middleware can’t mint nonces.** FAILURE: any future XSS sink becomes immediately executable (no nonce/hash CSP). Current HTML sinks look escaped (`waypointPin.ts` `esc()`, GymJsonLd `<` escape), but the safety net is thin. FIX: Netlify Edge header injection with per-request nonces, or move JSON-LD out of inline script.

- **[P3] [confidence: high] `src/app/auth/callback/route.ts:17-29` — same-origin `?next` guard is correct** (URL constructor, not `startsWith`). No open-redirect finding. Keep tests for `/\evil.com`, `//evil.com`, absolute external URLs.

- **Staff/service-role path (no issue found):** `requireStaffApi` → `getStaff`/`my_staff_role` before `getServiceClient()` (`src/lib/admin/api.ts:18-30`); admin layout 404s non-staff (`src/app/admin/(app)/layout.tsx:24-26`). Owner tables have restrictive deny-write policies (`20260623000001_owner_security_hardening.sql`). Owner photos anon-insert dropped (`20260623000002_owner_photos_signed_upload.sql`).

### C. Data integrity

- **[P1] [confidence: high] `src/components/gym/GymCard.tsx:159` — `{gym.neighborhood ?? "Tampa"}`.** FAILURE: a Miami (or any non-Tampa) gym without neighborhood renders as “Tampa” — fabricates geography, violates never-fabricate. FIX: fall back to city name prop, or omit the location chip when null.

- **[P2] [confidence: high] `src/lib/hours.ts:54-56` — overnight “closing soon” math uses today’s close clock without overnight wrap.** FAILURE: gym open 22:00–02:00 at 23:30 computes `minutesLeft = 120 - 1410 < 0`, never shows “Closes soon” in the last hour before 02:00; urgency UX wrong (open/closed via `isOpenNow` remains correct). FIX: if `closeMins <= openMins` or `closeMins < mins`, add 1440 before subtracting.

- **[P2] [confidence: med] `src/lib/scoring/scorer.ts:66-99` — equipment/amenity keys never hard-exclude; only rank.** FAILURE: query “powerlifting with squat racks” still lists amenity-only studios (low score + “No squat rack listed”). Kodawari is ranking-only, not pool-shaping — acceptance UX may feel noisy at 1800 gyms. FIX (product): optional “must-have” mode for equipment keys, or drop gyms with 0% equipment coverage when equipment was explicitly requested.

- **[OK — verified] FilterSet four-surface key parity:** migrations / `database.ts` Constants / `synonyms.ts` / `ai-search` EQUIPMENT+SEGMENTS all 154 / 11 with empty diffs. `open_24h` correctly absent from edge AMENITIES (boolean path). Client `aiSearch.sanitize` maps AI `segments`→`preferredSegments` and forces hard `segments: []`.

- **[OK — verified] `isOpenNow` blank-tuple / `00:00` close / overnight / timezone via `nowInZone`:** scorer + tests are intentional; hours display builds on `isOpenNow`.

- **[OK — verified] PostgREST numeric coercion** in `assembleGym` for prices/confidence/lat/lng.

- **[OK — verified] Loader provenance** (`scripts/lib/provenance.mjs` + `enrich.mjs` scraped 0.85 with `canOverwrite`).

### D. UI/UX

- **[P1] [confidence: high] `src/components/gym/GymCard.tsx:121-130` — list photos have no `onError`; `PhotoGallery.tsx:16-18` does.** FAILURE: hotlink-blocked/404 scraped URLs show broken images across the 747-card browse surface until rehost completes; detail gallery self-heals. FIX: same `onError` → hide img / show `SegmentScene`.

- **[P2] [confidence: high] `src/components/map/MapView.tsx:20-27,125-137` — only top 40 DOM pins; rest clustered.** Good scale pattern. FAILURE residual: cluster tier popups carry less affordance than ranked pins; keyboard users mostly get 40 pins. FIX: ensure unclustered layer is keyboard-reachable or document map as visual-only with list as a11y primary (list already is).

- **[P2] [confidence: med] `src/components/filters/FilterRail.tsx:17-47` — rail exposes a small amenity/equipment subset vs full taxonomy.** FAILURE: AI can set filters the rail can’t clear chip-by-chip (only via global reset / applied chips). Not contract drift, but discoverability gap. FIX: ensure `AppliedFilterChips` can remove every FilterSet member (verify equipment brands / min weights).

- **[P3] [confidence: high] `src/components/discovery/DiscoveryClient.tsx:243-259` — search telemetry best-effort; parse badge surfaces AI vs fallback.** Latency masking exists via `isParsing`. Zero-result / weak-match paths present. Good.

- **[P3] [confidence: med] Mixed-tier honesty:** `DataTierBadge` on basic cities; “Day pass unlisted” / estimated hedging in scorer reasons and map popups. Completeness-first browse order surfaces rich rows first (`scorer.ts:394-403`) — good. Residual: thin scraped cards still look like full listings until you open them.

### E. Testing quality

- **[P1] [confidence: high] No tests for PostgREST 1000-row / chunked join completeness.** FAILURE: the URL-length bug and the next silent-truncation bug are invisible to unit and e2e suites (e2e only checks first cards / counts > 0). FIX: unit-test a fake client that returns 1000-row pages; assert `fetchCityGyms` loops; assert child join pages when `IN_CHUNK * rowsPerGym > 1000`.

- **[P1] [confidence: high] No FilterSet surface-parity test.** FAILURE: next enum addition can ship in migrations + `database.ts` but miss `ai-search`/`synonyms` until prod drift. FIX: single vitest that imports Constants vs synonym keys vs a checked-in edge snapshot (or parse `ai-search/index.ts` lists).

- **[P2] [confidence: high] `tests/e2e/discovery/nl-search.spec.ts` is not `mode: "serial"` while `acceptance-searches.spec.ts:15` is.** FAILURE: under 3 workers + edge 20/min, NL specs flake into fallback path and still pass badge checks (`ai || quick`). FIX: serial + assert AI when key present, or mock edge.

- **[P2] [confidence: high] Critical paths with near-zero automated coverage:** owner claim token expiry/reuse (only one owner e2e), admin moderation/publish, RLS regression (no SQL/policy tests), loader idempotency/`canOverwrite`, sitemap completeness, gym-detail similar-spots query shape.

- **[P3] [confidence: med] `.textContent()` still used widely in e2e** (often after visibility asserts — mitigated but still the documented footgun). Prefer `toHaveText` / `count()`.

---

## What would make this bulletproof

1. **Pagination kit (P0/P1)** — one `paginateQuery()` helper used by `fetchCityGyms`, child joins, sitemap, admin lists; CI test that fails if any `from(x).select` in `src/lib/queries` lacks range when unbounded.
2. **List DTO + detail join split** — stop shipping full equipment graphs on `/` and `/city/*`; target <300KB city payload at 2k gyms.
3. **Gym detail similar-spots query** — `limit 4`, no `fetchCityGyms`.
4. **Kill `"Tampa"` neighborhood fallback**; pass `city.name` into cards.
5. **Image `onError` on GymCard/GymRow/map thumbnails**; finish rehost pipeline SLOs.
6. **FilterSet parity vitest + edge deploy checklist** (four surfaces + synonyms + Constants).
7. **Close open anon inserts** on telemetry tables (RPC + rate limit).
8. **Load test** (you already have `loadtest/`) against city + gym detail at 2k gyms: p95 TTFB, payload bytes, scoreGyms main-thread time.
9. **RLS smoke suite** — anon can SELECT catalog, cannot SELECT owner_*, cannot INSERT gyms; authenticated non-staff cannot hit admin APIs.
10. **Monitoring** — alert on `llm_gate` budget_exceeded, Supabase 5xx rate, city page TTFB, sitemap URL count vs `count(*)` live gyms.

---

*Read-only audit. ~35 findings retained after discarding noise; line cites from code actually opened in this pass. FilterSet enum drift: none found today.*
