# Scout — Verified-Fixes Plan & Delegation

**Status:** proposed · **Author:** Fable 5 · **Date:** 2026-07-15
**Source:** [independent-review artifact](https://claude.ai/code/artifact/f1d09c6c-53a4-470d-b272-b9fd1b5db012) — 15 confirmed + 4 partial defects (repo-aware Codex, adversarially verified) + 5 still-open items from the blind API round.

This plan groups every open item into 8 work packages, sequences them by shared-file dependency, assigns each to the model best suited to it, and ends with a single Fable verification gate. Nothing here is executed yet — this is the blueprint for approval.

---

## Guardrails that constrain every package

1. **Never-fabricate.** Unknown → "unlisted"; estimates badged ≤0.7; provenance ladder owner > scout_verified > user > scraped > seed/osm/city_data > estimated. Several fixes exist *because* a surface violates this.
2. **FilterSet four-surface contract.** Any change to `scorer.ts` scoring semantics must stay consistent across filterStore ↔ nlParser ↔ ai-search edge fn ↔ scorer, plus synonyms.ts, in one commit with a full edge redeploy. WP-A and WP-B touch this core.
3. **LLM-role rule.** LLMs only parse language into references to structured data (FilterSet or fact IDs); they never score or generate claims. WP-E must preserve this.
4. **Migrations** apply to prod `hblldqsccjpiikbhyknd` **and** the mirror, expand/contract style, reviewed before apply.
5. **isOpenNow is the single source of hours truth** — WP-A unifies the fork rather than adding a second evaluator.

---

## Work packages

Severity tags are the verifiers' assessments. "Hot files" flags shared files that force serialization.

### WP-A — Time & hours correctness `[HIGH]`
Fixes: **#1 timezone** (server hero on UTC, client on viewer clock), **#13 open-now missing-day fork** (scorer says unknown, hours.ts says closed).
- Migration: `cities.timezone text not null default 'America/New_York'`; backfill IANA zones (Tampa/Miami/ATL/BOS/DC/Palm Beach = America/New_York, Dallas = America/Chicago, Phoenix = America/Phoenix, SF = America/Los_Angeles).
- Thread the gym's IANA tz into `isOpenNow`/`openStatus`; convert the current instant to gym-local weekday+minutes (use `Intl.DateTimeFormat` with `timeZone`, no new dep). Refresh status at the next open/close boundary.
- Unify missing-day semantics: a populated schedule missing today = **closed**; a truly empty/null hours map = **unknown**. Both `isOpenNow` and `openStatus` must agree; the openNow hard filter keeps letting genuine-unknown through.
- Hot files: `src/lib/scoring/scorer.ts`, `src/lib/hours.ts`, `src/app/gym/[slug]/page.tsx`, `GymCard.tsx`, `HoursDisplay.tsx`, `CompareTable.tsx`, `DiscoveryClient.tsx`, `TripDetail.tsx`.
- Owner: **Fable** (scoring core + four-surface + migration).

### WP-B — Discovery data model & scale `[HIGH]`
Fixes: **#2 non-live-city visibility + "Tampa" fallback** (17 gyms), **#16 fetchCityGyms 1000-row cap** (Miami blocker), **#7 open_24h null→false in Compare**, **#6-partial** thread source/confidence through `assembleGym`.
- Visibility: require `cities.is_live=true` in the sitemap gym query, the `/gym/[slug]` detail route, and `AddTripModal`/`fetchCities`. Replace the hard-coded `"Tampa"` neighborhood fallback with the gym's actual city name (already fetched on the page; pass city name into `GymCard`).
- Scale: replace whole-city hydration with a server-owned paginated read model — a Postgres RPC that scores server-side and returns ranked, paginated card projections + a stable cursor ending in `gym_id`. This is the single biggest refactor and the hard gate before Miami grows past 1,000 gyms.
- Tri-state `open_24h`: model as `true | false | null` end-to-end; Compare renders the existing "Unknown" glyph for null, `No` only for an explicit negative.
- Also fold in migration-drift cleanup: add the missing repo migration that sets `miami.is_live=true` (prod has drifted from the migrations dir).
- Hot files: `src/lib/queries/gyms.ts`, `src/app/sitemap.ts`, `src/app/gym/[slug]/page.tsx`, `AddTripModal.tsx`, `scorer.ts` (server-side scoring path).
- Owner: **Fable** (queries + four-surface + Miami blocker). Serializes after/with WP-A on `scorer.ts`.

### WP-C — Provenance & display truthfulness `[MED]`
Fixes: **#6 estimated facts unbadged** on GymCard chips, match reasons, map popups, Compare cells, detail-hero chips; **#8 nudge invents spend** (copy).
- Thread `source`/`confidence` (from WP-B's `assembleGym` change) into every claim-bearing surface; render a ProvenanceBadge / "Estimated" treatment on ≤0.7 rows; estimated match reasons phrase as "Estimated sauna", not "Has sauna". `vibe_tags` get per-tag source or drop from claim surfaces.
- `nudge.ts`: conditional copy ("If you paid the listed day-pass rate each visit…") — never an unconditional "Joining would save you money."
- Depends on WP-B. Hot files: `GymCard.tsx`, `waypointPin.ts`, `CompareTable.tsx`, `MatchBadge.tsx`, `nudge.ts`.
- Owner: **Sonnet worker** under Fable brief (well-scoped, follows WP-B's view-model shape).

### WP-D — Owner pipeline integrity `[HIGH]`
Fixes: **#5 O1** non-transactional publish, **O2** quantity=0 stays listed, **O3** b_access can't clear open_24h, **O4** "Owner-verified" driven by gym-wide flag.
- Move publish into one Postgres RPC transaction: `SELECT … FOR UPDATE` the submission, recheck status, apply all catalog writes + logs, set final status atomically, idempotency key.
- Quantity 0 → **delete** the equipment row (or honor an explicit `present` flag everywhere).
- Make `b_access` authoritative: a staffed-only/appointment answer clears `open_24h` and any 24h amenity fact.
- Add per-field source columns for hours/day-pass (migration); render "Owner-verified" only when *that field's* current value came from an owner submission.
- Hot files: `src/app/admin/api/owner-queue/[id]/publish/route.ts`, `src/lib/owner/parse.ts`, `formConfig.ts`, `DropInCard.tsx`, `HoursDisplay.tsx` + migration.
- Owner: **Fable** (transactional RPC + schema).

### WP-E — Ask Scout correctness `[MED-HIGH]`
Fixes: **#11 compound any-yes verdict**, **#17 qualified/comparison questions** ("under $20?" → yes with $25), **#18 fact-id regex → exact catalog allowlist**, **#19 missing published/status filter**, **#12 "verified facts" copy overclaim**.
- Replace the any-yes aggregate with a constrained operator the LLM emits alongside fact IDs (`exists` / `compare(op,value)` / `and` / `or` / `open_on(day)`), evaluated **server-side** against typed values. Mixed compound with a failing conjunct → `cannot_answer` or an explicit per-part answer. Preserves the LLM-role rule (still references only, no scoring).
- Fact-id guard: intersect model output with `new Set(catalog.map(e => e.id))` — a well-formed fake id must be dropped, not resolved to a synthetic `not_listed`.
- `fetchGymFacts`/gym lookup: add the `status not in (closed,moved,duplicate)` filter the detail page uses.
- Copy: "answers only from verified facts" → "answers only from facts on file."
- Self-contained (edge fn + one component). Needs an edge redeploy. Hot files: `supabase/functions/ask-gym/index.ts`, `askTemplates.ts`, `AskScout.tsx`.
- Owner: **Sonnet worker** for the operator redesign (tight Fable brief) **+ Codex** for the 3 isolated sub-fixes (#18 allowlist, #19 filter, #12 copy).

### WP-F — Community & data-integrity RLS `[HIGH]`
Fixes: **#4 review_photos cross-review attach**, **#10 review gym_id PATCH ghost ratings**, **#9 fact_confirmations garbage-key inflation**.
- `review_photos` insert policy must require the referenced review's `user_id = auth.uid()` (or a security-definer insert RPC) + storage-path prefix check.
- Make `gym_reviews.gym_id`/`user_id` immutable post-insert (trigger raise), or broaden the rating trigger to refresh both old and new gym on any update.
- Fact confirmations only via a security-definer RPC that validates the `fact_key` references a real current catalog fact; dedicated `confirmed_at` column changed only by an explicit reconfirm; length/rate limits.
- Pure migrations (+ small client call-site changes for the confirm RPC). Hot files: three migration files + `FactConfirm.tsx`, `CommunitySection.tsx`.
- Owner: **Fable** (security migrations to prod).

### WP-G — Loader safety `[HIGH]`
Fixes: **#3 rank-blind loaders** (overwrite/delete owner data; womens-load delete-and-recreate), **#15 hours 99:99 validator + publish gate**.
- Shared rank-aware upsert helper: refuse to overwrite/delete a higher-provenance row with a lower-ranked source; reconcile only rows the loader owns. Apply across `enrich.mjs`, `seed.mjs`, `parking-enrich.mjs`, `machine-load.mjs`, `decision-enrich.mjs`.
- `womens-load.mjs`: upsert the stable gym row, never `delete()` the gym (stop the review/visit/follow cascade + ID churn).
- Tighten hours validators (`land.mjs`, `enrich.mjs`) to semantic bounds (00:00–24:00); reject `99:99`. Decide the land.mjs auto-activate gate (staging vs. price-range only) — recommend keeping text-stated facts at scraped/0.85 but adding a bounds check + a `--land` human confirm step for new-gym activation.
- **Must land before any Miami re-enrichment pass.** Self-contained (scripts only). Hot files: `scripts/*.mjs`.
- Owner: **Fable-brief + Sonnet or Codex** (isolated but high-stakes; diff reviewed by Fable).

### WP-H — Sync & abuse hardening `[MED]`
Fixes: **#14 trip create+add race**, **#20 durable rate limit + spend ceiling + kill switch** (both LLM endpoints), **S1a/S1b merge write-back + retry** (partials), **S2 relation-chunk fail-loud** (latent).
- Serialize per-trip cloud mutations (or a transactional upsert RPC carrying the final gym-ID set) so add-gym can't beat the insert.
- Replace the per-isolate in-memory limiter with a durable Postgres-backed limiter keyed on trusted platform IP; add per-day project/user quotas, a spend breaker, and an env-flag kill switch that disables LLM calls without a redeploy. Applies to `ai-search` and `ask-gym`.
- Merge: persist tuple-collision unions back to `cloud_trips`; set the session marker only after merge succeeds.
- `chunkedIn`: assert/fail-loud when a relation page returns exactly 1000 rows.
- Hot files: `tripStore.ts`, `merge.ts`, `AuthGate.tsx`, both edge fns + a small limiter migration.
- Owner: **Sonnet worker(s)** under Fable brief.

---

## Sequencing (dependency-driven)

- **Phase 1 — Foundation (Fable, serialized on hot files):** WP-B → WP-A. Both touch `queries/gyms.ts` + `scorer.ts`; WP-B's `assembleGym` source threading unblocks WP-C. One commit each, edge redeploy where the four-surface contract is touched.
- **Phase 2 — Parallel workers (Sonnet + Codex):** WP-C (needs Phase 1), WP-E, WP-H run concurrently on disjoint files.
- **Phase 3 — High-stakes migrations & data (Fable):** WP-D, WP-F, WP-G. Migrations to prod + mirror; loader safety before any Miami data work.
- **Phase 4 — Verification gate (Fable):** see below.

Front-loaded critical set if staged: **WP-A, WP-B, WP-F, WP-G** = "Cycle 1" (two live-in-prod user-visible bugs, the Miami blocker, the security holes, and the data-destruction risk). WP-C/D/E/H = "Cycle 2."

---

## Delegation matrix

| Package | Model | Why |
|---|---|---|
| Briefs for **all** packages | **Fable** | Full-context instructions; each brief carries file list, constraints, "done" definition. |
| WP-A, WP-B, WP-D, WP-F | **Fable (direct)** | Scoring core / four-surface / transactional RPCs / security migrations to prod — highest blast radius. |
| WP-C, WP-E (operator), WP-H | **Sonnet 5 workers** (Workflow, parallel) | Well-scoped "follow the blueprint" implementation on disjoint files. |
| WP-E sub-fixes (#18/#19/#12), WP-G validators, nudge copy | **GPT-5.6 / Codex** (workspace-write on secrets-stripped mirror) | Genuinely isolated, small, easy-to-port diffs — real ChatGPT task work without the four-surface risk. Fable ports + reviews each diff. |
| Final independent review of the complete diff | **GPT-5.6 / Codex** (read-only, repo-aware) | Proven strongest at this; second adversarial pass before Fable's gate. |

**Why Codex isn't handed the big refactors:** repo-aware Codex must run against a secrets-stripped mirror (`.env.local` is readable in the real tree), so any workspace-write output has to be hand-ported. That's fine for small isolated diffs, but for cross-cutting production changes it adds risk and friction with no upside over a Sonnet worker editing in place. Codex's highest-value roles here are (a) a few isolated implementations and (b) the final independent review.

---

## Phase 4 — Fable verification gate

After all packages land, Fable runs one end-to-end verification (not just typecheck):
1. **Build + typecheck** the whole app; edge functions deploy clean.
2. **Live-DB assertions:** timezone backfilled on all cities; no non-live-city gym in the sitemap query; no gym resolves the "Tampa" fallback; `get_secret`/new RPC grants correct; new RLS policies reject the cross-user attacks (two-user negative tests); confirmation RPC rejects garbage keys.
3. **Preview drive** (browser pane): gym hero shows correct open/closed for the gym's local time; Compare shows "Unknown" not "No" for missing 24h; an estimated fact renders a badge on card + map + compare; Ask Scout answers "pool and sauna?" and "day pass under $20?" correctly.
4. **Loader dry-runs:** rerun `enrich`/`parking-enrich` dry against a gym with a seeded owner fact → confirm no downgrade; `womens-load` upserts without deleting.
5. **Independent Codex review** of the full diff as a pre-gate; Fable adjudicates its findings.
6. Report: what shipped, what verified, what deferred — with costs.

---

## Open decisions (for approval)
1. **Scope of this run** — full queue in one delegated cycle, or staged (Cycle 1 critical → Cycle 2)?
2. **ChatGPT/Codex depth** — recommended split (isolated task work + final review) vs. Claude-only implementation with Codex review only vs. lean heavier on Codex.
3. **Migrations** — apply to prod as each package lands (project norm), or stage all migrations for one review before applying?
