# QA Report: Gym Detail Page

**Feature slug:** gym-detail  
**Scribe:** qa-scribe (Phase 6)  
**Date:** 2026-06-10  
**Pipeline run:** Analyst → Architect → Engineer → Sentinel (1 cycle) → Healer (1 round) → Scribe  

---

## Executive Summary

The Scout Gym Detail page stack passed QA with a **final test pass rate of 37/37 (100%)**. No real application bugs were found. One test infrastructure issue (the Playwright shared-page fixture trap) was diagnosed and corrected during the Healer phase.

---

## Pages Tested

| Gym | Slug | Data Shape |
|---|---|---|
| Powerhouse Gym Athletic Club | `powerhouse-gym-athletic-club` | Rich: equipment, parking, transit, gallery, monthly + day pass |
| Kodawari Studios | `kodawari-studios` | Studio: recovery amenities, classes, day pass |
| Amped Fitness Carrollwood | `amped-fitness-carrollwood` | New listing: 24h, women's area, no day-pass price, no gallery, no parking |

---

## Test Coverage

### By Spec File

| Spec File | Tests | P0 | P1 | P2 | Pass |
|---|---|---|---|---|---|
| hero.spec.ts | 8 | 5 | 3 | 0 | 8/8 |
| train-here.spec.ts | 1 | 1 | 0 | 0 | 1/1 |
| gallery.spec.ts | 2 | 1 | 1 | 0 | 2/2 |
| attribute-sections.spec.ts | 8 | 3 | 3 | 2 | 8/8 |
| hours.spec.ts | 2 | 2 | 0 | 0 | 2/2 |
| getting-in.spec.ts | 3 | 2 | 0 | 1 | 3/3 |
| parking-transit.spec.ts | 5 | 0 | 4 | 1 | 5/5 |
| community.spec.ts | 6 | 0 | 6 | 0 | 6/6 |
| seo.spec.ts | 1 | 1 | 0 | 0 | 1/1 |
| similar-spots.spec.ts | 1 | 0 | 1 | 0 | 1/1 |
| **Total** | **37** | **15** | **18** | **4** | **37/37** |

### By Feature Area

| Area | Key Verified Behaviors |
|---|---|
| Hero | h1 name; segment chip; neighborhood; day-pass chip (present/absent); Directions (Google Maps href + _blank); Call (tel: present/absent by data); Website (_blank); Back to Explore (href="/") |
| TrainHere | Signed-out click opens SignInModal (role=dialog); email input visible; no crash |
| Gallery | Scroll container present with ≥1 img on Powerhouse and Kodawari; absent on Amped (1 photo = no strip) |
| AttributeSections | Equipment heading + Pro preview chip (Powerhouse, Amped); machine key labels in fact rows; Web Data provenance badge on all gyms; Estimated badge on Powerhouse; 0 confirm/correct buttons signed-out; confidence % chips; Women's-Only Area on Amped; no Equipment on Kodawari |
| Hours | Open/Closed now chip + section on regular gyms; "Open 24 hours, every day" + Open now on Amped |
| Getting In | Walk in policy (Powerhouse); Book first policy (Kodawari); break-even math line when both monthly + day pass present |
| Parking & Transit | Primary rec block; alternatives list; transit footer with bus stop; OSM attribution; absent on Amped |
| Community | Inside left column (not aside); sign-in button instead of form signed-out; outbound links target=_blank + rel=noopener; at least 1 link on Powerhouse; Verify mailto on all; Amped has 0 links, section still renders |
| SEO | JSON-LD script exists, parses cleanly, @type=ExerciseGym, name matches gym |
| Similar Spots | Section heading matches /Similar.*spots/i; ≥1 /gym/ link; all hrefs well-formed |

---

## Artifacts Produced

| Phase | Artifact |
|---|---|
| Phase 1 — Analyst | `specs/features/gym-detail-analysis.md` |
| Phase 2 — Architect | `specs/plans/gym-detail-test-plan.md` |
| Phase 3 — Engineer | `tests/pages/GymDetailPage.ts` |
| Phase 3 — Engineer | `tests/fixtures/gymDetail.ts` |
| Phase 3 — Engineer | `tests/e2e/gym-detail/` (10 spec files, 37 tests) |
| Phase 4 — Sentinel | `specs/audits/gym-detail-audit.md` |
| Phase 5 — Healer | `specs/healing/gym-detail-healing-log.md` |
| Phase 6 — Scribe | `specs/reports/gym-detail-report.md` |

---

## Selector Stability Notes

Selectors are grounded in the live DOM analysis (specs/features/gym-detail-analysis.md). Key stability considerations:

- `li.group\/fact` (escaped Tailwind slash syntax) — stable; generated directly from `AttributeSection` component's `group/fact` class
- `section.survey-grid-night` for hero scoping — stable; hardcoded class on the hero `<section>`
- `div.flex.gap-2.overflow-x-auto` for gallery — stable; condition guarded by `photos.length > 1`
- `[role="dialog"][aria-label="Sign in to Scout"]` — stable; ARIA attributes in SignInModal component
- `span:has-text("Web Data")` — stable; ProvenanceBadge renders source label text directly

---

## Infrastructure Issue (Healer Phase)

**Issue:** Playwright shared-page fixture trap — when a single test requests all three gym fixtures (`powerhousePage`, `kodawariPage`, `ampedPage`), all three share one browser page object. The last `goto()` wins, causing all three POM instances to operate against the Amped page.

**Resolution:** Multi-gym tests restructured to navigate within the test body using a single fixture page (`new GymDetailPage(powerhousePage.page, slug)` + `await gymPage.goto()`). Single-gym tests unchanged.

**Impact:** 6 tests failed initially, 0 after healing. No test logic changes — only navigation strategy changed.

**Pattern documented:** This matches the discovery-core-bugs.md `.textContent()` on absent elements pattern — a class of test infrastructure pitfalls now formally documented for this codebase.

---

## Real App Bugs Found

**None.**

All surfaces tested behave as designed:
- Gallery absent on gyms with ≤1 photo — by design (`photos.length > 1` guard)
- Parking section absent on Amped — by design (`ParkingCard` returns null when no parking/transit data)
- No confirm/correct buttons signed-out — by design (FactConfirm client component is auth-gated)
- Call link absent on Amped — by design (no phone in gym data)
- Day-pass chip absent on Amped — by design (day_pass_price is null)

---

## Non-Goals (Confirmed Out of Scope)

- Signed-in flows (no test account provisioned)
- Map mini-image pixel-level checks
- Compare and Trips features
- Mobile breakpoint layout testing
- Review form submission
- FactConfirm button behavior when authenticated
