# Healing Log: gym-detail

**Feature slug:** gym-detail  
**Healer:** qa-healer (Phase 5)  
**Date:** 2026-06-10  
**Healing rounds:** 1  

---

## Initial Run Results

**37 tests, 6 failed, 31 passed**

Failed tests:
- HERO-01: h1 shows gym name on all three gyms
- HERO-02: segment chip shows correct label on all three gyms
- HERO-03: neighborhood text rendered in hero meta paragraph
- HERO-04: day-pass chip present on powerhouse and kodawari; absent on amped
- HERO-06: Call link (tel:) present on powerhouse and kodawari; absent on amped
- SEO-01: JSON-LD script exists, parses cleanly, and has ExerciseGym @type with correct name

---

## Failure Analysis

### Root Cause: Shared-Page Fixture Trap

All 6 failures share a single root cause: **Playwright fixture isolation**.

The fixture (`tests/fixtures/gymDetail.ts`) defines three fixtures (`powerhousePage`, `kodawariPage`, `ampedPage`) each using the shared `page` fixture. When a test requests all three fixtures simultaneously, Playwright's fixture system resolves them against the **same browser page object** per worker. Each fixture's `goto()` navigates the shared page, with the last navigation winning.

Execution order during fixture setup:
1. `powerhousePage.goto()` → navigates to `/gym/powerhouse-gym-athletic-club`
2. `kodawariPage.goto()` → navigates to `/gym/kodawari-studios`
3. `ampedPage.goto()` → navigates to `/gym/amped-fitness-carrollwood`

All three POM objects then operate against the Amped page. `powerhousePage.h1()` returns "Amped Fitness Carrollwood" — causing HERO-01 to fail with the exact error seen: `Expected: "Powerhouse Gym Athletic Club", Received: "Amped Fitness Carrollwood"`.

**This is a test infrastructure issue, not an app bug.**

---

## Healing Action: Round 1

**Strategy:** Restructure multi-gym tests to navigate within the test body using a single fixture page object, bypassing the shared-page limitation.

**Tests modified:**
- `hero.spec.ts` — HERO-01 through HERO-08: added `GYMS` constant array; each test loops through gyms using `new GymDetailPage(powerhousePage.page, slug)` + `await gymPage.goto()`
- `attribute-sections.spec.ts` — ATTR-03, ATTR-05: same pattern for cross-gym assertions
- `community.spec.ts` — COM-01, COM-02, COM-05: same pattern
- `hours.spec.ts` — HRS-01: same pattern for powerhouse + kodawari
- `seo.spec.ts` — SEO-01: same pattern

**Tests not modified** (already single-gym or correctly isolated):
- `train-here.spec.ts` (TH-01) — powerhousePage only
- `gallery.spec.ts` (GAL-01, GAL-02) — one fixture per test
- `getting-in.spec.ts` (GI-01, GI-02, GI-03) — one fixture per test
- `parking-transit.spec.ts` (PARK-01..05) — powerhousePage or ampedPage only
- `attribute-sections.spec.ts` ATTR-01, 02, 04, 06, 07, 08 — single fixture per test

---

## Post-Healing Run Results

**37 tests, 0 failed, 37 passed** — 100% pass rate

---

## Real App Bugs Found

None. All failures were test infrastructure issues (shared-page fixture trap). The app behaves correctly on all tested pages.

No `specs/bugs/gym-detail-bugs.md` file created (no real app bugs found).
