# Phase 2b — security & moderation hardening

Executor notes. **No commit / push / deploy / migration-apply** from this clone.
Reviewer applies migrations `20260722000003`–`00005`, deploys edge functions, and ships.

## 1. apikey gate: presence → value check

**Files:** `supabase/functions/ai-search/index.ts`, `supabase/functions/ask-gym/index.ts`

Both edge functions now compare the `apikey` header to
`Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SB_PUBLISHABLE_KEY")`.

- Match → authorized.
- Missing header → 401 (unchanged).
- **Fail-safe:** if neither env var is set, log `console.warn` once per isolate and
  fall back to presence-only (current weaker behavior). Does not brick the endpoint.

Reviewer: redeploy **full** `index.ts` for both functions (partial deploy breaks prod).

## 2. Telemetry insert gating

**Inspection:** only client writers found:

| Table        | Writer                                      |
|--------------|---------------------------------------------|
| `search_logs`| `DiscoveryClient.tsx` (browser, fire-and-forget) |
| `ask_logs`   | `AskScout.tsx` (browser, fire-and-forget)   |

No server/edge writers. Both need RPCs (not policy-drop-only).

**Migration:** `20260722000003_telemetry_insert_gating.sql`

- `log_search(p_query, p_parsed_via, p_result_count, p_top_score, p_anon_id)`
- `log_ask(p_gym_id, p_question, p_verdict, p_fact_ids, p_anon_id)`
- Caps text to 300; validates `parsed_via ∈ {ai,fallback}`; sanitizes `fact_ids` array
- Throttles via `rate_counters`: **30 inserts/hour** per key
  (`auth.uid()` → optional `p_anon_id` → shared `anon` bucket)
- Drops policies `"anyone can log searches"` and `"anyone can log ask-scout queries"`
- Granted to `anon` + `authenticated`

**Client:** both call sites switched to `.rpc(...)`; fire-and-forget preserved.
**Types:** `database.ts` Functions entries for `log_search` / `log_ask`.

## 3. Review auto-hide → staff flag

**Migration:** `20260722000004_report_review_flag_not_hide.sql`

- `report_review` still dedups reporters and sets `report_count = distinct count`
- **No longer** sets `hidden = true` at ≥3 reports
- **No longer** calls `refresh_gym_rating` on report (rating only changes when staff hide)

**Admin surface:** `src/lib/admin/moderation.ts` already:

- counts `report_count >= 1` as `reportedReviews`
- `listReviews("reported")` filters `report_count >= 1`
- orders by `report_count` desc

No query change required — flagged reviews already surface for staff.

## 4. Scalar provenance `gyms.data_source`

**Migration:** `20260722000005_gyms_data_source.sql`

- Column `data_source text` nullable, check ∈ `{scraped, seed, owner}` (null = curated/unknown)

**Writers:**

| Path | Value |
|------|-------|
| `scripts/land.mjs` insert | `'scraped'` |
| `scripts/land.mjs --repair` patch | `'scraped'` |
| `admin/api/owner-queue/[id]/publish/route.ts` | `'owner'` on catalog-changing gym update (single clean write site — added) |

**Types / assemble:** `database.ts` Row/Insert/Update · `scout.ts` EnrichedGym ·
`assembleGym` passthrough · card path null-fills (detail-only surface) · `testFactory`.

**UI:** when `data_source === 'scraped'` AND relevant `*_verified_at` is null:

- Hours → `ProvenanceBadge source="estimated" confidence={0.7}` next to section title
- Getting-in (prices) → same badge when day pass is listed
- **Description:** no existing subtle provenance hint on the detail blurb — left
  unbadged (per brief: don't invent a new visual language)

## 5. `land.mjs --repair`

```sh
node scripts/land.mjs --metro=miami --repair          # dry
node scripts/land.mjs --metro=miami --repair --land   # write
```

Finds pipeline gyms (`facility_candidates.gym_id` join) in the target metro with
**zero amenities AND zero equipment AND null hours**, re-runs text+vision extract
from cached pages, upserts facts with the same scraped/estimated provenance rules,
and only fills empty scalar fields. Re-runnable; prints a summary.

Shared helpers extracted: `loadCachedPages`, `extractFacts`, `factRows`.

## 6. Unsubscribe GET side-effect (P3)

**File:** `src/app/api/unsubscribe/route.ts`

- **GET:** minimal HTML confirmation page + POST button (token in hidden field).
  No DB write. Prefetchers are safe.
- **POST:** performs unsubscribe (form or JSON body), redirects to
  `/unsubscribe?ok=1|0` (303). Idempotent; still never leaks email.

Existing `/unsubscribe` landing page unchanged.

## Self-verify

- `npx tsc --noEmit` → 0
- `npx vitest run` → all pass
- No `.env*` touched
- No commit/push/deploy/migration-apply

## Reviewer checklist

1. Apply migrations `20260722000003`, `00004`, `00005` (in order).
2. Deploy full `ai-search/index.ts` and `ask-gym/index.ts`.
3. Smoke: NL search still logs (via RPC); ask-scout still logs; report review no longer hides; unsubscribe GET does not unsubscribe.
