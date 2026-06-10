# Pipeline Log

This file is the audit trail for the qa-pipeline and dev-pipeline. Each feature run appends entries here.

---

## QA Run: discovery-core
- **Started:** 2026-06-10T00:00:00Z
- **Orchestrator:** qa-council
- **Target URL:** http://localhost:3100
- **Request:** Full qa-pipeline for Scout's DISCOVERY CORE — NL search, acceptance searches, segment icon row, filter rail, list cards, map view. Tests organized under tests/e2e/discovery/. Non-goals: voice input, geolocation activation, auth flows.

### Phase progression
- Phase 1 (Analyst): COMPLETE — specs/features/discovery-core-analysis.md
- Phase 2 (Architect): COMPLETE — specs/plans/discovery-core-test-plan.md (16 P0 / 20 P1 / 3 P2 = 39 total)
- Phase 3 (Engineer): COMPLETE — 7 spec files, 4 POMs, 1 fixture; tsc + eslint clean
- Phase 4 (Sentinel): PASS (1 cycle) — specs/audits/discovery-core-audit.md; 2 minor issues fixed
- Phase 5 (Healer): COMPLETE — 38/39 pass; 1 real bug (ACC-03 AI edge function timeout under load); 3 healing rounds; 2 bugs filed
- Phase 6 (Scribe): COMPLETE — specs/reports/discovery-core-report.md

### QA Pipeline complete: discovery-core
- **Completed:** 2026-06-10T00:00:00Z
- **Phases:** Analyst → Architect → Engineer → Sentinel (1 cycle) → Healer (3 rounds) → Scribe
- **Final pass rate:** 38/39 (97.4%) parallel; 38/39 with --workers=1 (ACC-03 infrastructure bug)
- **Bugs documented:** 2 (BUG-01: AI edge function throttle; BUG-02: amenity filter UX)
- **Artifacts:**
  - specs/features/discovery-core-analysis.md
  - specs/plans/discovery-core-test-plan.md
  - specs/audits/discovery-core-audit.md
  - specs/healing/discovery-core-healing-log.md
  - specs/bugs/discovery-core-bugs.md
  - specs/reports/discovery-core-report.md
  - tests/e2e/discovery/ (7 spec files)
  - tests/pages/ (4 POMs)
  - tests/fixtures/discovery.ts

---

## QA Run: gym-detail
- **Started:** 2026-06-10T00:00:00Z
- **Orchestrator:** qa-council
- **Target URL:** http://localhost:3100
- **Request:** Full qa-pipeline for Scout's GYM DETAIL stack. Three test gyms: /gym/powerhouse-gym-athletic-club (rich), /gym/kodawari-studios (studio), /gym/amped-fitness-carrollwood (new listing). Scope: Hero, TrainHere, Gallery, AttributeSections, Hours, Getting-in card, Parking/transit, CommunitySection, SEO JSON-LD, Similar spots.

### Phase progression
- Phase 1 (Analyst): COMPLETE — specs/features/gym-detail-analysis.md
- Phase 2 (Architect): COMPLETE — specs/plans/gym-detail-test-plan.md (12 P0 / 14 P1 / 4 P2 = 30 plan tests → 37 actual after fixture restructuring)
- Phase 3 (Engineer): COMPLETE — 10 spec files, 1 POM, 1 fixture; tsc + eslint clean
- Phase 4 (Sentinel): PASS (1 cycle) — specs/audits/gym-detail-audit.md; no critical issues
- Phase 5 (Healer): COMPLETE — 37/37 pass after 1 healing round; 0 real app bugs; shared-page fixture trap diagnosed and fixed
- Phase 6 (Scribe): COMPLETE — specs/reports/gym-detail-report.md

### QA Pipeline complete: gym-detail
- **Completed:** 2026-06-10T00:00:00Z
- **Phases:** Analyst → Architect → Engineer → Sentinel (1 cycle) → Healer (1 round) → Scribe
- **Final pass rate:** 37/37 (100%)
- **Bugs documented:** 0
- **Artifacts:**
  - specs/features/gym-detail-analysis.md
  - specs/plans/gym-detail-test-plan.md
  - specs/audits/gym-detail-audit.md
  - specs/healing/gym-detail-healing-log.md
  - specs/reports/gym-detail-report.md
  - tests/e2e/gym-detail/ (10 spec files, 37 tests)
  - tests/pages/GymDetailPage.ts
  - tests/fixtures/gymDetail.ts
