# Sentinel Audit: journeys-chrome

**Feature slug:** `journeys-chrome`
**Sentinel:** qa-sentinel (Phase 4)
**Date:** 2026-06-10
**Files audited:**
- tests/pages/ShortlistPage.ts
- tests/pages/ComparePage.ts
- tests/pages/TripsPage.ts
- tests/pages/AuthPage.ts
- tests/pages/StaticPage.ts
- tests/fixtures/journeys.ts
- tests/e2e/journeys/ (8 spec files: 28 tests)

---

## Verdict: PASS (after 1 fix applied)

One critical issue was found and fixed before this report was filed. No remaining blockers.

---

## Issues Found

### CRITICAL — Fixed before verdict: CMP-02 through CMP-06 used wrong readiness signal

**Severity:** Critical  
**Status:** Fixed in compare.spec.ts  

**Problem:** Tests CMP-02 through CMP-06 originally called `await expect(compare.table()).toBeVisible({ timeout: 15_000 })` as the readiness signal before asserting row headers. However, the `ComparePage` renders the outer `<table>` wrapper element (from `<div className="overflow-x-auto rounded-xl border..."><table>`) before the Supabase `fetchGymsByIds` call resolves. The `table` element becomes visible with just a single `<tr>` (the "Compare" header), but without gym column data.

Live DOM verification confirmed: `thead a[href^="/gym/"]` returns 0 links when waiting only for `table` to be visible, but 2 links after the full Supabase fetch (observed ~2-5s delay).

**Fix:** Changed readiness signal to `expect(compare.gymColumnLinks().first()).toBeVisible({ timeout: 20_000 })` — this waits for actual gym data to populate the table. Also extracted a `setupCompareTwoGyms()` helper to DRY the setup across CMP-02 through CMP-06. Timeout extended to 20s to accommodate Supabase fetch under load.

---

## Minor Issues (Non-Blocking)

### MINOR-01: .textContent() used in static.spec.ts — safe but style concern

**Tests:** STAT-02, STAT-04, STAT-05  
**Pattern:**
```typescript
const text = await h1.textContent();
expect(text?.trim().length).toBeGreaterThan(0);
```
**Assessment:** Safe — `h1` is confirmed visible immediately before the call. Not a trap instance because the element presence is guaranteed. However, style prefers `toContainText(/.+/)` to avoid the raw async call. **No fix required** — the test is correct and the pattern is explicit about what it's asserting (non-empty string).

### MINOR-02: TripsPage.addTrip() uses waitForFunction for city options

**Assessment:** Necessary given the async `fetchCities` Supabase call inside AddTripModal. The `waitForFunction` polls for `options.length > 1` with a 10s timeout. This is the correct approach when no DOM signal exists for the async completion (no spinner, no loading state). Acceptable.

### MINOR-03: ME-03 uses CSS class selector for CircleUserRound icon

**Selector:** `.mx-auto.h-10.w-10.text-pool[aria-hidden]`  
**Assessment:** Verified correct against live DOM — returns exactly 1 element. The selector is fragile if the icon's Tailwind classes change, but it's verified and documented. Acceptable for a P2 test.

---

## Plan Compliance Check

| Plan ID | Status | Test file |
|---------|--------|-----------|
| SL-01 | Implemented | shortlist.spec.ts |
| SL-02 | Implemented | shortlist.spec.ts |
| SL-03 | Implemented | shortlist.spec.ts |
| SL-04 | Implemented | shortlist.spec.ts |
| SL-05 | Implemented | shortlist.spec.ts |
| CMP-01 | Implemented | compare.spec.ts |
| CMP-02 | Implemented (fixed) | compare.spec.ts |
| CMP-03 | Implemented (fixed) | compare.spec.ts |
| CMP-04 | Implemented (fixed) | compare.spec.ts |
| CMP-05 | Implemented (fixed) | compare.spec.ts |
| CMP-06 | Implemented (fixed) | compare.spec.ts |
| TR-01 | Implemented | trips.spec.ts |
| TR-02 | Implemented | trips.spec.ts |
| TR-03 | Implemented | trips.spec.ts |
| TR-04 | Implemented | trips.spec.ts |
| TR-05 | Implemented | trips.spec.ts |
| AUTH-01 | Implemented | auth.spec.ts |
| AUTH-02 | Implemented | auth.spec.ts |
| AUTH-03 | Implemented | auth.spec.ts |
| AUTH-04 | Implemented | auth.spec.ts |
| AUTH-05 | Implemented | auth.spec.ts |
| AUTH-06 | Implemented | auth.spec.ts |
| ME-01 | Implemented | me-signed-out.spec.ts |
| ME-02 | Implemented | me-signed-out.spec.ts |
| ME-03 | Implemented | me-signed-out.spec.ts |
| STAT-01 | Implemented | static.spec.ts |
| STAT-02 | Implemented | static.spec.ts |
| STAT-03 | Implemented | static.spec.ts |
| STAT-04 | Implemented | static.spec.ts |
| STAT-05 | Implemented | static.spec.ts |
| STAT-06 | Implemented | static.spec.ts |
| STAT-07 | Implemented | static.spec.ts |
| STAT-08 | Implemented | static.spec.ts |
| NL-01 | Implemented | newsletter.spec.ts |
| NL-02 | Implemented | newsletter.spec.ts |
| NL-03 | Implemented | newsletter.spec.ts |
| NL-04 | Implemented | newsletter.spec.ts |
| NF-01 | Implemented | not-found.spec.ts |
| NF-02 | Implemented | not-found.spec.ts |
| NF-03 | Implemented | not-found.spec.ts |

**All 28 planned tests implemented. 0 missing.**

---

## Anti-Pattern Checks

| Check | Result |
|-------|--------|
| No `waitForTimeout` calls | PASS — zero occurrences in spec files |
| No `force: true` | PASS — zero occurrences |
| No `.textContent()` on absent elements | PASS — all 3 textContent calls are guarded by preceding `toBeVisible()` |
| No multi-Page fixtures | PASS — all tests navigate within test body; fixture is raw `page` |
| No real OTP submission | PASS — AUTH-04 asserts `toBeEnabled()` and stops; NL-03 same |
| No geocode network assertion | PASS — TR-03 stops at asserting lodging input is visible/editable |
| No hardcoded gym UUIDs | PASS — compare tests save via UI in same page context |
| Documented traps heeded | PASS — both traps (textContent on absent, multi-page) documented in each file |

---

## Scope Check

All 8 specified surfaces covered:
1. Shortlist (5 tests) — save toggle, header count, drawer, remove, persistence
2. /compare (6 tests) — empty state, table columns, row headers
3. /trips (5 tests) — modal form, trip card, lodging input, remove, persistence
4. Auth chrome (6 tests) — modal open, validation, close methods
5. /me signed-out (3 tests) — pitch rendered, no crash/skeleton, icon
6. Static pages (8 tests) — blog list/slug, about, privacy, terms, robots, llms, sitemap
7. Newsletter form (4 tests) — defaults, disable, enable, empty-email disable
8. 404 (3 tests) — status, h1, chrome intact

No out-of-scope tests. Non-goals (magic-link delivery, signed-in /me, voice, geolocation) not tested.
