# Sentinel Audit Report: Discovery Core

**Feature slug:** `discovery-core`
**Auditor:** qa-sentinel
**Date:** 2026-06-10
**Verdict:** PASS

---

## Audit Summary

| Category | Status | Notes |
|---|---|---|
| Anti-patterns | PASS | No `waitForTimeout`, no `force:true` |
| POM compliance | PASS (after fix) | Raw chip locators in nl-search.spec.ts moved to POM method |
| Plan coverage | PASS | All 39 test IDs present and accounted for |
| Selector validity | PASS | All selectors verified against analyst's confirmed list |
| Scope | PASS | No voice input, geolocation activation, or auth tests included |
| TypeScript | PASS | `tsc --noEmit` clean |
| ESLint | PASS | 0 errors, 0 warnings after fixes |

---

## Issues Found and Resolved

### Issue 1 (Minor — Fixed)
**File:** `tests/e2e/discovery/nl-search.spec.ts`
**Problem:** Three occurrences of `discoveryPage.page.locator('form[role="search"] + div button')` used directly in spec bodies instead of a POM method, violating encapsulation.
**Fix:** Added `exampleChips(): Locator` method to `DiscoveryPage` POM; updated all three spec call sites to use `discoveryPage.exampleChips()`.

### Issue 2 (Minor — Fixed)
**File:** `tests/pages/DiscoveryPage.ts`
**Problem:** `chipsContainer: Locator` property defined but never read (dead code; replaced by the new `exampleChips()` method).
**Fix:** Removed the `chipsContainer` property; replaced with the `exampleChips()` method.

---

## Plan Compliance Check

| Spec file | Plan tests | Implemented | Verdict |
|---|---|---|---|
| nl-search.spec.ts | NL-01–08 | 8 | PASS |
| acceptance-searches.spec.ts | ACC-01–03 | 3 | PASS |
| segment-row.spec.ts | SEG-01–05 | 5 | PASS |
| filter-rail.spec.ts | FILT-01–07 | 7 | PASS |
| gym-cards.spec.ts | CARD-01–06 | 6 | PASS |
| map-view.spec.ts | MAP-01–07 | 7 | PASS |
| near-me-ui.spec.ts | NM-01–03 | 3 | PASS |
| **Total** | **39** | **39** | **PASS** |

---

## Anti-Pattern Scan

- `waitForTimeout`: 0 occurrences
- `force: true`: 0 occurrences
- Raw `page.click()` / `page.fill()` in spec files: 0 occurrences
- Invented selectors (not from analyst doc): 0

---

## Scope Compliance

Non-goals confirmed absent:
- Voice input (`VoiceButton`): not tested
- Geolocation activation: NM-03 tests UI toggle only (mode switch), not geolocation API call
- Auth flows: not tested

---

## Risk Observations (Not Blocking)

1. **ACC-01 match badge selector:** `div.absolute.left-3.top-3` is a positional class combo. If Tailwind purges or class names change, this selector breaks. Acceptable for now — analyst confirmed from live source.
2. **FILT-06 weak-match trigger:** Checking 6 amenities is expected to trigger the banner, but depends on live data. If the data changes and 6 amenities still have 3+ matches with score >= 70, the banner won't appear. The healer should note this if the test fails.
3. **MAP-03 pin count = 35:** Asserts exact equality. If any gym has null lat/lng, this will fail legitimately. The healer should file this as a data observation, not a test bug.
4. **ACC-02 exact gym names:** "Fox Fitness" and "Peach Lab" — exact string match. If the database has a different name (e.g. "Fox Fitness Studio"), the test will fail. The healer should check the live name first.
