# Fable 5 — independent audit findings (written BEFORE reading external auditors)

Method: targeted verification of the highest-risk surfaces (scale, security, data
integrity, UX, tests), each checked against live code/DB/prod this session.

## Findings

### A. Scale & bulletproofing

- [P1] [confidence: high] src/lib/queries/gyms.ts:230 (fetchCityGyms) — no `.range()`/pagination;
  PostgREST caps responses at 1000 rows. Tampa (747 visible) fits today; Miami scale-up (~1,800)
  will SILENTLY truncate the catalog (no error — gyms just vanish from browse).
  FAILURE: Miami loads, ~800 gyms missing, nobody notices. FIX: paginate with .range() loops
  (or a city_gym_count check + chunked fetch), plus a regression test that fails at >1000.

- [P1] [confidence: high] Homepage/city page payload — measured live: **2.02 MB HTML, 7.6s TTFB**
  for 747 gyms (force-dynamic RSC renders every enriched gym server-side; no pagination or
  virtualization anywhere in src/app or components — verified no react-window/virtuoso usage).
  At Miami ~1,800 this doubles+. FAILURE: mobile users on LTE wait 15s+; Netlify function
  runtime cost balloons. FIX: server-side pagination or initial-N + lazy fetch; consider
  ISR/cache for anonymous browse; virtualize the list client-side.

- [P1] [confidence: high] src/app/sitemap.ts:9 — `.select("slug, updated_at, city_id")` with no
  range: same 1000-row cap. ~800 visible gyms today (fits); breaks silently at Miami scale-up,
  dropping newest gyms from SEO. FIX: paginate; assert count matches a HEAD count query.

- [P2] [confidence: high] scripts (land.mjs etc.) load `gyms` with a single select in some
  helper paths (audit-prep.mjs pages correctly at 1000/step — good) — land.mjs
  `db.from("gyms").select("slug, name, city_id, lat, lng")` is uncapped-but-1000-limited too;
  at >1000 total gyms the dedup set goes blind. FIX: reuse the pager from audit-prep.mjs.

### B. Security

- [OK] [confidence: high] RLS: all 32 public tables have RLS enabled. app_flags/rate_counters/
  review_reports are deny-all (0 policies) by design — review reporting goes through the
  `report_review` RPC (CommunitySection.tsx:210), admin clears via service role. Verified.

- [OK] [confidence: high] XSS spot-checks clean: waypointPin.ts sets a static SVG shell only
  (gym name flows through textContent / setAttribute — safe); GymJsonLd escapes `<` in the
  JSON-LD script payload. No other raw-HTML injection sites found in src/.

- [OK] [confidence: med] ai-search edge fn: apikey-header gate (index.ts:235), per-isolate
  rate limit + durable gate RPC (ok/rate_limited/budget_exceeded/disabled), input caps,
  neighborhood vocab forced empty for cities without curated vocab (anti-fabrication).
  Residual risk: per-isolate limit resets on cold start (accepted design), durable gate is
  the real backstop — good.

- [P2] [confidence: med] Scraped photo URLs are hotlinked whenever storage_path is null
  (GymCard falls back to `gym.photo_url`). Beyond broken images (below), hotlinking third-
  party images sends user referers to arbitrary scraped hosts and lets those hosts swap
  image content later. FIX: only render our Storage transform URLs (storage_path); treat
  photo_url-only gyms as no-photo until rehost succeeds.

### C. Data integrity

- [OK] [confidence: high] Timezone: scorer/isOpenNow evaluated with nowInZone(gym.timezone)
  at all call sites checked (scorer.ts:90,283; GymCard status effect). The old UTC bug class
  is closed.

- [P2] [confidence: med] 187 of 1,340 Tampa photo rehosts failed (dead/hotlink-blocked
  sources); those gym_photos rows keep external URLs, and 4 visible gyms remain unsegmented.
  FIX: null-out or prune gym_photos rows whose source is confirmed dead; segment the last 4.

### D. UI/UX

- [P2] [confidence: high] GymCard.tsx:~123 — `<img>` has no onError fallback. With scraped
  photo_url as fallback src, dead/blocked URLs render broken-image glyphs on cards (already
  guaranteed: 187 known-dead source URLs). FIX: onError → swap to SegmentScene placeholder;
  prefer storage-only rendering (see B).

- [P1] [confidence: high] 747-card city browse with no pagination/virtualization/"load more"
  — combined with the 2MB payload this is the single biggest UX cliff at current scale, and
  it doubles at Miami. (Same fix as A-2.)

### E. Testing

- [P1] [confidence: high] Zero tests on the exact bug class that took prod down this week:
  src/lib/queries/gyms.ts has no unit/integration tests (chunkedIn, fetchCityGyms truncation),
  and src/lib/search/nlParser.ts has NO test file at all (fallback parser = 1 of the 4
  FilterSet surfaces). Scorer is well-covered (3 files); owner flow, admin auth covered.
  FIX: (1) chunkedIn unit test w/ >50 ids; (2) a seeded-DB integration test asserting
  fetchCityGyms returns EXACTLY the visible count at >1000 gyms; (3) nlParser golden tests
  mirrored against the edge-fn contract; (4) a FilterSet four-surface drift test that fails
  when a key exists in one surface but not the others.

## What would make this bulletproof (my list, pre-external)

1. Pagination/virtualization + payload diet for city browse (fixes A-2/D-2 together).
2. .range() pagination in fetchCityGyms + sitemap + loader gym-list reads, each with a
   truncation regression test.
3. Storage-only photo rendering + onError fallback; prune dead photo rows.
4. FilterSet four-surface drift test + nlParser golden suite.
5. Basic uptime/error monitoring (the outage this week was only caught because I probed
   prod manually — add a Netlify/UptimeRobot check on / and one gym page + Supabase log alert).
6. Load test rerun at Miami-scale row counts before the scale-up lands.
