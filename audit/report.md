# Scout — Final Audit Council Report (merged & cross-verified)

**Council:** Kimi K3 (`moonshot/kimi-k3`, CLI, read-only mirror) · Grok 4.5 (`grok-4.5`, CLI, read-only
mirror) · Claude Fable-line synthesis seat (independent pass written before reading externals, then
cross-verified every external claim against live code/DB/prod). Sol excluded by direction.
**Verification rule:** 2+ auditor agreement = high confidence; single-auditor claims were individually
verified against code or live DB before inclusion. Findings that failed verification are listed at the end.

## Verdict (unanimous)

**Tampa-launch-viable today; NOT scale-safe for Miami (~1,800 gyms) until the P1 scale pack lands.**
The honesty architecture (provenance, RLS, owner-flow hardening, deterministic scoring) held up under
three independent audits — the exposure is concentrated in scale ceilings, one invariant drift, a
fallback-parser correctness bug, and test/monitoring gaps.

---

## P1 — must fix before Miami (all verified)

| # | Finding | Where | Caught by |
|---|---------|-------|-----------|
| 1 | Unpaginated selects silently truncate at PostgREST's 1000-row cap: sitemap (SEO collapse), admin master list, **admin data-quality cockpit (ALREADY wrong today — 1,987 amenity rows vs 1000 cap, verified live)**, `land.mjs` dedup set (**would create duplicate gyms during the Miami run**) | `src/app/sitemap.ts:10` · `src/lib/admin/gyms-admin.ts:53,105` · `scripts/land.mjs:112` | all three |
| 2 | Full-city pipeline runs where a tiny query belongs: gym detail loads ALL 747 gyms for 4 "similar" cards; city page runs `fetchCityGyms` TWICE per request (generateMetadata + body, no `cache()`) | `src/app/gym/[slug]/page.tsx:218` · `src/app/city/[slug]/page.tsx:25,45` | Grok + Kimi, verified |
| 3 | Full enriched catalog serialized into RSC payload — **measured live: 2.02 MB / 7.6 s homepage TTFB** at 747 gyms; ~2× at Miami, trending at Netlify's response cap | `src/app/page.tsx` · city page | all three (Fable measured) |
| 4 | **FilterSet invariant-#1 drift:** 9 amenity keys (`chalk_allowed, wheelchair_accessible, accessible_restrooms, hydromassage, open_gym, props_provided, retail_shop, spin_studio, tanning`) exist in scout.ts + synonyms + edge-fn prompt but **not in the DB `amenities` table** (verified live) → permanently dead filters; "wheelchair accessible gym" can never match anything | `src/lib/types/scout.ts:41-49` vs `public.amenities` | **Kimi only** — Grok checked equipment/segments (in sync) and missed the amenity↔DB surface |
| 5 | Fallback NL parser matches raw substrings: "running **track**"→squat_rack, "good en**erg**y"→rower, "**box** jumps"→crossfit, "s**pin**e corrector"→cycling, "pilates **barre**l"→barre (all reproduced) — and this parser is exactly what users get when the edge fn rate-limits their shared IP | `src/lib/search/nlParser.ts:33` + `synonyms.ts:42,52,200,208,209` | **Kimi only**, verified |
| 6 | **Fabrication bug:** `{gym.neighborhood ?? "Tampa"}` — any non-Tampa gym without a neighborhood renders "Tampa" on its card. Violates never-fabricate; fires the day Miami relies on it | `src/components/gym/GymCard.tsx:159` | Grok + Kimi, verified |
| 7 | `gym.website` (scraped/owner-supplied) rendered into `href` with no scheme validation → stored-XSS class (`javascript:` URL), and CSP still allows `unsafe-inline` | `src/app/gym/[slug]/page.tsx:346` · loaders store verbatim | **Kimi only**, verified |
| 8 | The discovery e2e suite pins the catalog to `toBe(35)` in 3 specs — **the suite cannot pass against today's 747-gym DB, so it isn't running**, and its 35-row world structurally can't catch either shipped scale bug | `tests/e2e/discovery/{nl-search,segment-row,filter-rail}.spec.ts` | **Kimi only**, verified |
| 9 | Zero regression tests for the bug classes that already bit (URL-length, 1000-row truncation, FilterSet drift), no nlParser tests, no RLS suite | `tests/`, `src/lib/queries` | all three |

## P2 — fix during the same cycle (verified)

- `search_logs`/`ask_logs` anon INSERT `with check (true)` — telemetry spam/bloat vector (Grok; verified in migrations).
- ai-search/ask-gym `apikey` gate is presence-only (any non-empty header passes) + CORS `*` — durable llm_gate is the real barrier, but a botnet can drain the daily cap for legit users (Grok + Kimi; verified `index.ts:235`).
- "Closing soon" never shows during the pre-midnight stretch of overnight hours (`hours.ts` close-math), and `isOpenNow` misses *yesterday's* overnight carry-over when adjacent days differ (Kimi + Grok; verified — narrower than reported: same-day overnight ranges work).
- Missing-day hours render "Closed today" while `isOpenNow` treats the same day as unknown — a fabrication path when the pipeline's `cleanHours` dropped a malformed day (Kimi; verified `hours.ts:35-47`).
- `GymCard` `<img>` has no `onError` fallback (PhotoGallery has one); 187 known-dead scraped URLs today (all three; verified).
- LLM-extracted scalars (hours/prices/description from `land.mjs`) carry no row-level provenance and render unbadged — inconsistent with the fact-row honesty system (Kimi; verified by design review).
- `land.mjs` per-gym writes are non-transactional → crash mid-gym leaves fact-less "ghost" listings that re-runs skip as DUP (Kimi; verified logic; add a zero-facts repair query).
- `fetchGymsByIds`/`fetchGymsBySlugs` still use unchunked `.in()` — same URL-length class as the fixed bug; unbounded via shortlist/trips (Grok + Kimi; verified).
- `chunkedIn` guards ID-count but not response-row-count — latent: worst 50-gym window today = 437/420 rows vs 1000 (Fable measured); add a `length===1000` assert (Grok's #1, downgraded after measurement).
- Review auto-hide at 3 distinct reports with no staff loop — 3 throwaways can hide legit reviews (Kimi; verified in migration).
- Prod middleware question: `next.config.ts` comment vs `proxy.ts` comment contradict on whether session-refresh middleware registers in prod builds — **verify the deployed manifest + a >1h session this week**; if refresh is browser-only by design, document it and delete the stale comment (Grok + Kimi; unresolvable statically).

## P3 (queue behind the above)

Unsubscribe via GET (mail prefetchers), email_subscribers anon insert w/o rate limit, owner invite token in query string, HydrationGate empty-flash on /trips, MapView `restGymIdsKey` string churn, e2e `.textContent()` residue, acceptance-searches asserting exact live-data names/order, owner-guard fail-open on empty allow-list (documented tradeoff — consider fail-closed in prod).

## Confirmed clean by 2+ independent auditors

Equipment/segment/status enum parity across all TS/DB surfaces (154/11/6, programmatic diff) · RLS coverage on all 32 tables incl. service-only owner tables + definer RPCs · owner invite flow (hashed single-use tokens, atomic claim, signed uploads, per-IP caps) · auth-callback redirect guard (survives `//evil.com` + backslash tricks) · JSON-LD + map-popup escaping · deterministic scorer + provenance hedging + KODAWARI soft-segments · numeric wire-string coercion · loader provenance tiering (seed refuses to overwrite higher tiers) · no secrets in repo.

## Council scorecard

- **Kimi K3:** deepest report; 4 exclusive P1s (amenity drift, parser collisions, website XSS, dead e2e pins) — all verified. One false line-cite (`enrich.mjs:87` is a per-slug lookup, not an uncapped list) and one overstated scope (isOpenNow carry-over). First run hung on its own subagent fan-out (headless deadlock); single-agent retry produced everything above.
- **Grok 4.5:** fastest; strong on scale-query analysis (detail-page full-city fetch, double metadata fetch, admin caps) and telemetry-table policies; called FilterSet "in lockstep" because it only diffed the TS/edge surfaces — missed the DB-table surface Kimi checked. Its #1 (chunk response cap) was mathematically right but overstated for current data (measured 2.3× headroom).
- **Fable (this seat):** only auditor to measure prod live (2.02 MB payload, 1,987-row truncation proof, 437-row chunk worst-case) and to catch the sitemap + land.mjs caps independently; matched externals on 6 of 9 P1s; wrongly framed the card list as unpaginated (it pages at 24 — the payload, not the DOM, is the problem; corrected by Grok).

## The finishing roadmap

**Phase 1 — Scale pack (before ANY Miami work):** one shared `paginateAll()` helper → sitemap, fetchCityGyms, admin list, data-quality (move to SQL aggregates), land.mjs + loader reads; targeted similar-gyms query + `cache()`-wrapped city fetch; slim list DTO to cut the RSC payload (budget: <500 KB city page); `chunkedIn` 1000-row assert; chunk fetchGymsByIds/Slugs.
**Phase 2 — Integrity & security patches:** insert the 9 amenity rows (keeps the filters) + word-boundary matching in nlParser; kill the `?? "Tampa"` fallback; `safeHttpUrl()` at loader-write AND render; presence→value check on the apikey gate; gate/limit telemetry inserts; scalar-provenance column + badges; land.mjs transactional writes + ghost-listing repair; overnight hours fixes; GymCard onError.
**Phase 3 — Test hardening:** un-pin the e2e counts (fixture DB or DB-derived); FilterSet four-surface contract test incl. the DB table; nlParser collision corpus; pagination/truncation regression pack (mock-PostgREST at 2,500 rows); RLS smoke suite; owner-claim concurrency test.
**Phase 4 — Monitoring & launch gates:** uptime checks on `/` + one gym page; alerts on PostgREST 400s, function duration/payload, llm_gate non-ok, daily LLM spend; rehost-coverage count as a Miami gate; post-deploy k6 smoke with payload budget.
**Phase 5 — Miami scale-up (gated on 1–4):** rerun the pipeline at ~1,800, then re-run the load test at Miami row counts.

Estimated council cost: ≈$3–5 total (Kimi K3 ~1M in / Grok 4.5 ~0.5M in at $2/$6 — both CLIs meter via API keys).
