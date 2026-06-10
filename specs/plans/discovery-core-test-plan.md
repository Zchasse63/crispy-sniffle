# Test Plan: Discovery Core

**Feature slug:** `discovery-core`
**Architect:** qa-architect
**Date:** 2026-06-10
**Input:** specs/features/discovery-core-analysis.md
**Test directory:** `tests/e2e/discovery/`
**POM directory:** `tests/pages/`

---

## 1. Page Objects Required

| File | Responsibility |
|---|---|
| `tests/pages/DiscoveryPage.ts` | Root page: navigate, search, read count, parse badge, query chip, reset |
| `tests/pages/SegmentIconRowPage.ts` | Segment icon row interactions |
| `tests/pages/FilterRailPage.ts` | Amenity checkboxes, day pass slider, clear all |
| `tests/pages/MapViewPage.ts` | Map toggle, canvas, pin count, popup interactions |

---

## 2. Test Files

| File | Suite | Priority |
|---|---|---|
| `tests/e2e/discovery/nl-search.spec.ts` | NL Search & Example Chips | P0 |
| `tests/e2e/discovery/acceptance-searches.spec.ts` | Acceptance Searches (live data ordering) | P0 |
| `tests/e2e/discovery/segment-row.spec.ts` | Segment Icon Row | P0 |
| `tests/e2e/discovery/filter-rail.spec.ts` | Filter Rail (amenities, day pass, reset) | P1 |
| `tests/e2e/discovery/gym-cards.spec.ts` | GymCard list view features | P1 |
| `tests/e2e/discovery/map-view.spec.ts` | Map view toggle, pins, popup | P1 |
| `tests/e2e/discovery/near-me-ui.spec.ts` | Near Me UI structure (no geolocation) | P2 |

---

## 3. Detailed Test Cases

### 3.1 nl-search.spec.ts (P0) — 8 test cases

| ID | Name | Description | Assertion |
|---|---|---|---|
| NL-01 | example chips visible on load | Navigate to /, check search input empty, chips present | 3 chip buttons visible: "vibey yoga studio", "lift heavy with a sauna, under $25", "trendy gym that's instagram friendly" |
| NL-02 | click chip runs search | Click "vibey yoga studio" chip | Button shows "Plotting" during parse; parse badge appears; query chip shows "vibey yoga studio"; example chips disappear |
| NL-03 | manual search submit | Type text, click "Scout it" | Same as NL-02 outcome |
| NL-04 | parse badge: AI-parsed | After any chip/search, check badge | Either "AI-parsed" (Sparkles) or "Quick-parsed" (Wrench) badge visible — accept either |
| NL-05 | query chip present with correct text | After search, sticky bar | Quoted chip `"vibey yoga studio"` present in sticky bar |
| NL-06 | count bar updates after search | After yoga search, count | `N gyms` where N < 35 (filtered result) |
| NL-07 | clear search via X button | Click X on query chip | Count returns to 35, example chips reappear, no badge |
| NL-08 | submit disabled when input empty | On load | "Scout it" button has `disabled` attribute |

### 3.2 acceptance-searches.spec.ts (P0) — 3 test cases

| ID | Name | Description | Assertion |
|---|---|---|---|
| ACC-01 | yoga studio with cold plunge → Kodawari first with score 100 | Search "yoga studio with a cold plunge" | First gym card is Kodawari Studios; match badge shows score 100 |
| ACC-02 | women's only gym → Fox Fitness and Peach Lab in top 2 | Search "women's only gym" | First two gym cards are Fox Fitness and Peach Lab (order may vary between them, both must be in positions 1–2) |
| ACC-03 | lift heavy day pass under $25 → correct gyms in top 3, >$25 absent | Search "lift heavy with a day pass under $25" | 813 Barbell or Powerhouse in first 3 cards; no visible card has day_pass_price > $25 (check text in cards) |

### 3.3 segment-row.spec.ts (P0) — 5 test cases

| ID | Name | Description | Assertion |
|---|---|---|---|
| SEG-01 | 9 segment buttons rendered | Navigate to / | `nav[aria-label="Gym types"] button` count === 9 |
| SEG-02 | click segment hard-filters | Click "Strength & Powerlifting" button | aria-pressed becomes "true"; gym count drops below 35 |
| SEG-03 | click again clears filter | Click pressed segment button again | aria-pressed becomes "false"; count restores |
| SEG-04 | only one-of segment changes count | Click each segment in isolation | Each produces a different (smaller or equal) gym count |
| SEG-05 | soft segment shows dashed style and ~ | Run NL search that implies a segment (e.g. "yoga studio") | A segment button gains border-dashed class and its label text ends with " ~" |

### 3.4 filter-rail.spec.ts (P1) — 7 test cases

| ID | Name | Description | Assertion |
|---|---|---|---|
| FILT-01 | amenity checkbox filters results | Check "Sauna" checkbox | Result count decreases |
| FILT-02 | uncheck restores results | Uncheck "Sauna" | Count returns to prior value |
| FILT-03 | day pass slider reduces results | Move slider to $25 | Count bar shows "≤ $25"; result count decreases |
| FILT-04 | slider at max shows "Any price" | Ensure slider at 60 | Display text is "Any price" |
| FILT-05 | clear all resets filters | Check 2 amenities, click "Clear all" | Count returns to 35, "Clear all" button disappears |
| FILT-06 | weak-match banner on over-constraint | Check 6+ amenities | Banner with Compass icon visible; at least one relax chip present |
| FILT-07 | relax chip loosens filter | With banner visible, click a relax chip | That filter is removed; banner re-evaluates (may hide if resolved) |

### 3.5 gym-cards.spec.ts (P1) — 6 test cases

| ID | Name | Description | Assertion |
|---|---|---|---|
| CARD-01 | cards show gym name and neighborhood | Unfiltered list | First 3 cards each have `h3.display` text (non-empty) and MapPin span text |
| CARD-02 | open status chip format | Check cards with hours data | At least one card has Clock-sibling span; text matches regex `/Open ·|Closes|Opens/` |
| CARD-03 | FREE PARKING chip present on some cards | Unfiltered list | At least one card shows "free parking" chip |
| CARD-04 | match badge and why-it-fits appear when query active | Run "sauna" search | Cards show match badge; "Why it fits:" section visible |
| CARD-05 | card is a link to gym detail | Check first card | `a[href^="/gym/"]` wraps the card |
| CARD-06 | day pass price shown on card | Unfiltered | At least some cards show "$N day" text in readout row |

### 3.6 map-view.spec.ts (P1) — 7 test cases

| ID | Name | Description | Assertion |
|---|---|---|---|
| MAP-01 | map toggle switches view | Click "Map" button | `aria-pressed="true"` on Map button; `.mapboxgl-canvas` appears |
| MAP-02 | list toggle returns | Click "List" button | `aria-pressed="true"` on List button; `.mapboxgl-canvas` gone |
| MAP-03 | pin count equals gym count | Switch to map (unfiltered) | `.scout-pin` count === 35 (or all gyms with non-null coords) |
| MAP-04 | filter changes pin count | Switch to map, apply segment filter | `.scout-pin` count decreases proportionally |
| MAP-05 | pin click opens popup | Click first `.scout-pin` | `.mapboxgl-popup-content` visible; contains gym name text |
| MAP-06 | popup has "View gym →" link | After MAP-05 | `a` text "View gym →" present in popup |
| MAP-07 | popup parking line when present | Click pin for gym with parking | `div` in popup starts with "P · " |

### 3.7 near-me-ui.spec.ts (P2) — 3 test cases

| ID | Name | Description | Assertion |
|---|---|---|---|
| NM-01 | Drive and Walk buttons render | Check filter rail Near me section | Two buttons: "Drive" (aria-pressed="true" default) and "Walk" |
| NM-02 | minute chips render | Check filter rail | Three buttons: "10 min", "20 min", "30 min" |
| NM-03 | pending state disables chips | Click a minute chip (geolocation triggers) | Chips have `disabled` attribute while pending; show "Locating…" text |

---

## 4. Fixtures and Setup

### 4.1 Shared Fixture: `tests/fixtures/discovery.ts`
```typescript
import { test as base } from "@playwright/test";
import { DiscoveryPage } from "../pages/DiscoveryPage";

type Fixtures = { discoveryPage: DiscoveryPage };
export const test = base.extend<Fixtures>({
  discoveryPage: async ({ page }, use) => {
    const dp = new DiscoveryPage(page);
    await dp.goto();
    await use(dp);
  },
});
export { expect } from "@playwright/test";
```

### 4.2 Search Helper
Each test file that uses NL search must await the parse completion (button returns to "Scout it" text) before asserting results.

---

## 5. Constraints and Rules

- **No `waitForTimeout`** — use `waitForSelector`, `toBeVisible`, or `toHaveText` with Playwright's auto-waiting
- **No `force: true`** — all interactions via visible, enabled elements
- **No invented selectors** — all selectors from the analyst's verified list
- **Page Object Model mandatory** — no raw `page.click()` in spec files; all locators encapsulated in POMs
- **Acceptance tests use live data** — no mocking; run against http://localhost:3100 with real Supabase

---

## 6. Test Counts Summary

| Priority | Count |
|---|---|
| P0 | 16 tests (NL-01–08 + ACC-01–03 + SEG-01–05) |
| P1 | 20 tests (FILT-01–07 + CARD-01–06 + MAP-01–07) |
| P2 | 3 tests (NM-01–03) |
| **Total** | **39 tests** |

---

## 7. Acceptance Criteria for Pipeline Pass

- All P0 tests pass
- P1 tests pass or documented as real bugs
- P2 tests pass (UI structure only — no geolocation activation)
- No `waitForTimeout` or `force: true` in any test
- TypeScript compiles cleanly (`tsc --noEmit`)
