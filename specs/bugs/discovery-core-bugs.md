# Bugs: Discovery Core

**Feature slug:** `discovery-core`
**Filed by:** qa-healer
**Date:** 2026-06-10

---

## BUG-01: AI edge function hangs under concurrent load (ACC-03)

**Test:** `ACC-03` — acceptance-searches.spec.ts
**Severity:** Medium
**Status:** Open

### Description

The Supabase AI edge function (`/functions/v1/ai-search`) consistently times out when multiple concurrent Playwright workers all submit searches simultaneously. The function works correctly and quickly (~1.5–4.5s) when called in isolation or sequentially.

### Reproduction

Run the full discovery test suite with 6 parallel workers:
```
npx playwright test tests/e2e/discovery/ --workers=6
```

ACC-03 ("lift heavy with a day pass under $25") times out after 60s on both the initial run and the retry.

Run the same test alone or with `--workers=1`:
```
npx playwright test tests/e2e/discovery/acceptance-searches.spec.ts --workers=1
```
All three acceptance searches pass in ~16s total (1–4s each).

### Root Cause Analysis

When 6 workers fire simultaneously, each test that involves AI search (NL-03, NL-04, NL-06, SEG-05, ACC-01, ACC-02, ACC-03) makes concurrent POST requests to `https://hblldqsccjpiikbhyknd.supabase.co/functions/v1/ai-search`. Under this load, Supabase cold-starts or rate-limits one of the requests, causing it to stall for >60s.

The issue is NOT in the test logic or selectors — the results are correct when the function returns.

### Workaround

Run acceptance tests with `--workers=1`:
```
npx playwright test tests/e2e/discovery/ --workers=1
```

Or add a dedicated Playwright project for discovery tests:
```typescript
// playwright.config.ts — add a project
{ name: "discovery-serial", testMatch: "**/discovery/**", workers: 1 }
```

### Expected Behavior

The AI edge function should handle concurrent requests without stalling. Consider:
1. Pre-warming the edge function to avoid cold starts
2. Implementing a request queue on the client side for sequential AI calls
3. Adding Supabase Edge Runtime concurrency configuration

### App Behavior Observation (Not a Bug)

During this investigation, the following correct behaviors were confirmed:
- Amenity checkboxes in the FilterRail are **soft filters** (score-based) — they do NOT exclude gyms from the result set. Only maxDayPass, segments, neighborhood, open24h, and openNow are hard exclusion filters.
- NL/vibe queries (e.g., "vibey yoga studio") do not reduce the gym count below 35 — they reorder by match score only.
- The query chip uses Unicode left/right double quotation marks (U+201C / U+201D), not ASCII double quotes.

---

## BUG-02: Soft vs. hard filter behavior not communicated to users (UX observation)

**Test:** FILT-01 (originally written as a hard filter test, corrected during healing)
**Severity:** Low / UX concern
**Status:** Open (product decision needed)

### Description

Amenity checkboxes in the Filter Rail (Sauna, Cold Plunge, Pool, etc.) are soft filters — they affect match score ranking but do NOT exclude gyms from the result set. The count shown in the sticky bar (`N gyms`) does not change when amenity checkboxes are toggled.

This may be confusing to users who expect checking "Sauna" to show only gyms with a sauna.

### Evidence

- Checking "Sauna" + "Cold Plunge" + 4 more amenities: count stays at 35
- `clearAllVisible: true` confirms the filter IS applied to the store
- Only hard filters (day pass price ≤ $X, segment type, neighborhood, hours) change the count

### Recommendation

Either:
1. Add inline text to the amenities section explaining "Rankings by match — all gyms still shown"
2. OR make amenity filters hard exclusions (changes scoring logic — significant impact)
3. OR show a "sorted by match" indicator when soft filters are active

---

## Resolutions (P2-E fix round, 2026-06-10)

**BUG-01 — RESOLVED (test infrastructure + documented design).** Diagnosis:
the client already aborts the edge call at 8s and falls back to the local
parser; the app degrades correctly. The 60s timeouts came from 6-worker
stampedes: parallel dev-server cold compiles + the edge function's per-IP
rate limit (20/min, by design) pushing searches onto the fallback path while
a web-first assertion waited for AI-path output. Fixes: playwright.config
`workers: 3`; acceptance spec stays `mode: "serial"`. The rate limit is
load-shedding working as intended, not a defect.

**BUG-02 — FIXED (app copy).** Coverage scoring ranks rather than excludes
(by design — never hide, always rank with visible misses). The sticky count
now reads "N gyms · ranked by match" whenever filters are active
(DiscoveryClient sticky bar), so the unchanged count communicates the model
instead of reading as a bug.
