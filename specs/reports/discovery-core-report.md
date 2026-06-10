# QA Pipeline Report: Discovery Core

**Feature slug:** `discovery-core`
**Scribe:** qa-scribe
**Date completed:** 2026-06-10
**Target URL:** http://localhost:3100
**Pipeline run by:** qa-council

---

## Executive Summary

The Discovery Core feature — Scout's full-page gym-finder — passed 38 of 39 automated tests. One test (ACC-03) is blocked by a real infrastructure bug: the Supabase AI edge function stalls under concurrent worker load. All other feature areas are fully green.

Two real behaviors were documented that were initially misunderstood as test failures: amenity checkboxes are soft filters (rank, not exclude), and NL vibe queries don't reduce the gym count. Both have been documented for product review.

---

## Pipeline Phases

| Phase | Agent | Status | Output |
|---|---|---|---|
| 1 — Analysis | qa-analyst | COMPLETE | specs/features/discovery-core-analysis.md |
| 2 — Architecture | qa-architect | COMPLETE | specs/plans/discovery-core-test-plan.md |
| 3 — Engineering | qa-engineer | COMPLETE | 7 spec files + 4 POMs + 1 fixture |
| 4 — Sentinel | qa-sentinel | PASS (1 cycle) | specs/audits/discovery-core-audit.md |
| 5 — Healing | qa-healer | COMPLETE | specs/healing/discovery-core-healing-log.md |
| 6 — Scribe | qa-scribe | COMPLETE | specs/reports/discovery-core-report.md |

---

## Test Results

### Summary

| Priority | Total | Pass | Fail | Pass Rate |
|---|---|---|---|---|
| P0 | 16 | 15 | 1 | 93.8% |
| P1 | 20 | 20 | 0 | 100% |
| P2 | 3 | 3 | 0 | 100% |
| **Total** | **39** | **38** | **1** | **97.4%** |

### By File

| Spec file | Tests | Pass | Fail |
|---|---|---|---|
| nl-search.spec.ts | 8 | 8 | 0 |
| acceptance-searches.spec.ts | 3 | 2 | 1 |
| segment-row.spec.ts | 5 | 5 | 0 |
| filter-rail.spec.ts | 7 | 7 | 0 |
| gym-cards.spec.ts | 6 | 6 | 0 |
| map-view.spec.ts | 7 | 7 | 0 |
| near-me-ui.spec.ts | 3 | 3 | 0 |

### Failing Test

| ID | Test | Reason | Workaround |
|---|---|---|---|
| ACC-03 | lift heavy under $25 → 813 Barbell / Powerhouse top 3 | Supabase AI edge function stalls under concurrent load; passes in <2s when run solo | `--workers=1` |

---

## Verified Behaviors

### NL Search (8/8 pass)
- Example chips visible on load ("vibey yoga studio", "lift heavy with a sauna, under $25", "trendy gym that's instagram friendly")
- Clicking a chip triggers search, chips disappear, parse badge appears
- Manual search (type + submit) works equivalently
- Parse badge is "AI-parsed" (Sparkles) or "Quick-parsed" (Wrench) — confirmed both paths work
- Query chip in sticky bar shows the raw query wrapped in Unicode curly quotes (U+201C/U+201D)
- Submit button disabled when input is empty
- Clear (X) button on query chip resets all filters and restores 35-gym count

### Acceptance Searches (2/3 pass)
- **ACC-01**: "yoga studio with a cold plunge" → Kodawari Studios first, badge shows "100 match"
- **ACC-02**: "women's only gym" → Fox Fitness and Peach Lab in top 2 positions (exact names confirmed)
- **ACC-03**: Would pass; blocked by infrastructure bug (see BUG-01)

### Segment Icon Row (5/5 pass)
- 9 segment buttons rendered in expected order
- Click sets `aria-pressed="true"`, count drops
- Second click clears, count restores to 35
- Each segment type produces a valid (possibly 0) count in isolation
- AI search suggests a segment as soft (dashed border, label ends with " ~")

### Filter Rail (7/7 pass)
- Day pass slider at $15 reduces count (hard filter confirmed)
- Resetting slider to $60 restores full count
- Slider at $25 shows "≤ $25" in display
- Slider at $60 shows "Any price"
- "Clear all" button appears when any filter is active; resets to 35 when clicked; then disappears
- Weak-match banner: Recovery segment (2 gyms) + Group Classes (0/2 match) triggers banner reliably
- Relax chip on banner loosens a filter and increases count

### Gym Cards (6/6 pass)
- Each card shows gym name (h3.display) and neighborhood
- Open status chips present and match `/Open ·|Closes|Opens/` (time-dependent, confirmed at run time)
- "free parking" chip visible on at least one card
- Match badge (div.absolute.left-3.top-3) and "Why it fits:" text appear when a query is active
- Cards are links to `/gym/{slug}` detail pages
- Day pass price (`$N day`) shown on at least some cards

### Map View (7/7 pass)
- Map toggle sets `aria-pressed="true"` on Map button and renders `.mapboxgl-canvas`
- List toggle returns to card grid view
- Pin count equals gym count in unfiltered state (35 pins for 35 gyms)
- Segment filter reduces pin count proportionally
- Clicking a pin opens `.mapboxgl-popup-content` with gym name
- Popup contains "View gym →" link with `/gym/{slug}` href
- At least one popup shows parking line ("P · ...") for gyms with parking data

### Near Me UI (3/3 pass — UI structure only, no geolocation)
- Drive and Walk buttons render with correct aria-pressed states
- 10, 20, 30 min chips render
- Clicking Walk updates aria-pressed state correctly

---

## Bugs Filed

### BUG-01 (Medium) — AI edge function stalls under concurrent worker load

**Affects:** ACC-03 test; potentially any AI search under concurrent production load
**File:** specs/bugs/discovery-core-bugs.md
**Reproduction:** Run 6+ concurrent Playwright workers; ACC-03 times out after 60s
**Passes:** With `--workers=1`; 1.5s in isolation
**Recommendation:** Pre-warm edge function, add client-side request queueing for AI searches, or configure Supabase Edge Runtime for higher concurrency

### BUG-02 (Low / UX) — Amenity filter softness not communicated

**Affects:** User experience — users expect "Sauna" checkbox to exclude non-sauna gyms
**File:** specs/bugs/discovery-core-bugs.md
**Detail:** Amenity checkboxes rank by match score but all 35 gyms remain visible. Only hard filters (day pass price, segment type, neighborhood, hours) exclude gyms from the count.
**Recommendation:** Add a "Rankings by match — all gyms shown" note, or convert amenity filters to hard exclusions

---

## App Behavior Clarifications (Confirmed Correct, Not Bugs)

These behaviors were discovered during healing and are documented here for the team:

1. **Amenity checkboxes are soft**: Checking "Sauna" sets `filters.amenities = ["sauna"]` in the filter store, which affects match scoring but does NOT exclude gyms. The count stays at 35. This is by design per `scorer.ts` — only `maxDayPass`, `segments`, `neighborhood`, `open24h`, and `openNow` are hard exclusion filters.

2. **Vibe NL queries don't change count**: A "vibey yoga studio" query sets `preferredVibes` and `preferredSegments` (soft), not hard exclusions. All 35 gyms remain but are reranked. This is correct per the "Kodawari rule" noted in the source.

3. **Query chip uses curly quotes**: The sticky bar chip wraps the query in Unicode U+201C (`"`) and U+201D (`"`), not ASCII `"`. Tests use `.toContain("plain text")` to avoid encoding sensitivity.

---

## Artifacts

| Artifact | Path |
|---|---|
| Feature analysis | specs/features/discovery-core-analysis.md |
| Test plan | specs/plans/discovery-core-test-plan.md |
| Sentinel audit | specs/audits/discovery-core-audit.md |
| Healing log | specs/healing/discovery-core-healing-log.md |
| Bug report | specs/bugs/discovery-core-bugs.md |
| Final report | specs/reports/discovery-core-report.md |
| Test specs | tests/e2e/discovery/ (7 files) |
| POMs | tests/pages/DiscoveryPage.ts, SegmentIconRowPage.ts, FilterRailPage.ts, MapViewPage.ts |
| Fixture | tests/fixtures/discovery.ts |

---

## How to Run

```bash
# Full suite (parallel — ACC-03 may timeout due to BUG-01)
npx playwright test tests/e2e/discovery/

# Recommended: single worker (all 38 healable tests pass deterministically)
npx playwright test tests/e2e/discovery/ --workers=1

# P0 only
npx playwright test tests/e2e/discovery/nl-search.spec.ts tests/e2e/discovery/acceptance-searches.spec.ts tests/e2e/discovery/segment-row.spec.ts --workers=1

# Acceptance searches only (always serial)
npx playwright test tests/e2e/discovery/acceptance-searches.spec.ts
```
