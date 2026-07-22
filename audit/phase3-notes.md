# Phase 3 — Test hardening (implementation notes)

Executor work against audit P1#8, P1#9, and E-section. **No commit/push/deploy.** Playwright specs edited only (not run here). Unit suite + tsc verified locally.

## 1. Un-pin e2e catalog counts (P1#8)

Hardcoded `toBe(35)` / “below 35” pins broke the suite against the 747-gym DB.

| Spec | Change |
|------|--------|
| `tests/e2e/discovery/nl-search.spec.ts` NL-07 | Capture `catalogCount` via `getGymCount()` before search; after clear, `toBe(catalogCount)` |
| `tests/e2e/discovery/segment-row.spec.ts` SEG-03 | Same pattern on segment toggle clear |
| `tests/e2e/discovery/filter-rail.spec.ts` FILT-05 | Filter reduces below `catalogCount`; clear restores exact `catalogCount` |
| `tests/e2e/discovery/map-view.spec.ts` MAP-03 | Already compared pin count to sticky-bar `gymCount`; removed stale “35 gyms” comment. Assertion remains exact (`pinCount === gymCount`) |

Expectations stay **exact and derived** from the page’s own unfiltered counter — not `> 0` vacuous checks.

## 2. nl-search serial mode

`tests/e2e/discovery/nl-search.spec.ts` now has:

```ts
test.describe.configure({ mode: "serial" });
```

Matches `acceptance-searches` and CLAUDE.md (AI-dependent specs serial).

## 3. acceptance-searches invariants (Kimi E-item)

`tests/e2e/discovery/acceptance-searches.spec.ts` rewritten:

- Header documents that **exact name/order checks are manual smoke, not CI**.
- Invariants: result count > 0; first card has MatchBadge (`/\d+\s*match/i`); price texts all `≤ 25` on ACC-03; sticky count consistent with rendered cards.
- Smoke-level membership: top few cards include a name from a curated rich-tier pool (substring match) — not rank-1 pins like “Kodawari Studios first with 100”.
- Still `mode: "serial"`, 60s timeout.

## 4. FilterSet four-surface contract (P1#9)

New files:

- `src/lib/search/filtersetContract.test.ts` — diffs amenity/equipment/segment keys across:
  1. `AMENITY_LABELS` / `EQUIPMENT_LABELS` / `SEGMENT_LABELS` (scout.ts)
  2. `AMENITY_SYNONYMS` / `EQUIPMENT_SYNONYMS` / `SEGMENT_SYNONYMS`
  3. Edge fn source text (`supabase/functions/ai-search/index.ts`) via regex parser on `const AMENITIES|EQUIPMENT|SEGMENTS = [...]`
  4. Checked-in DB snapshot
- `src/lib/search/amenities.db-snapshot.json` — 32 keys from migrations:
  - base 19 (`20260609170003`)
  - + cafe, coworking (`20260610220001`)
  - + womens_area, womens_only (`20260610230001`)
  - + 9 P1#4 keys (`20260722000002`)
- **Deliberate exception:** `open_24h` present in scout/synonyms/DB, **absent** from edge `AMENITIES` (flows through `open24h` boolean).

Regenerate the JSON when an amenities migration lands (header comment in file + test).

## 5. Scale regression pack (P1#9)

| File | Coverage |
|------|----------|
| `src/lib/supabase/paginate.test.ts` | 2,500 rows / 3 pages; short-page terminate; error propagate; empty first page |
| `src/lib/queries/gyms.scale.test.ts` | `chunkedIn` 500 ids → 10×50 chunks; exact-1000 `console.warn` spy; error path; `fetchCityGyms` with mock client returns 1,200 enriched gyms (paging + empty child joins) |
| `src/lib/sitemap/buildSitemapEntries.ts` + `.test.ts` | Pure helper extracted from `sitemap.ts` (minimal); 1,500 gyms → only live-city URLs; dark cities dropped |

`chunkedIn`, `IN_CHUNK`, `CHUNK_ROW_CAP` exported from `gyms.ts` for direct unit tests (no behavior change).

## 6. RLS smoke script (bulletproof #9)

`scripts/rls-smoke.mjs` — run with `.env.local` (publishable/anon key):

- PASS: SELECT gyms, amenities
- PASS (deny): SELECT owner_invites, owner_submissions, staff_members, facility_candidates (0 rows or error)
- PASS (deny): INSERT gyms, search_logs, ask_logs
- PASS: `log_search` RPC
- Exit 1 on any FAIL

**Reviewer runs this** against live DB. Not vitest.

## Self-verify (this environment)

```
npx vitest run  →  22 files, 405 tests passed
npx tsc --noEmit →  0 errors
```

Playwright not executed (no server/env). Reviewer applies and runs e2e + rls-smoke.

## Out of scope / deferred

- Hermetic e2e seed DB (still live-catalog; counts now derived)
- Owner-claim concurrency test (Phase 3 roadmap item not in this brief’s numbered work)
- Running Playwright or RLS smoke here
