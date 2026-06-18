# Scout Admin Portal — Master Spec

*Designed 2026-06-18 via 8-agent functional-area workflow + synthesis. The operator (Zach) control surface for running Scout — replaces chat/SQL/loader workflows.*

> **DECISION (2026-06-18, Zach) — analytics RE-SEQUENCED to last.** The spec below argues analytics must be instrumented FIRST because the auth-less loop can't be reconstructed later. That urgency only applies **once there are real users** — and Scout is **not launching immediately** (the product/monetization shape is still being chosen). So with ~no live traffic, there is no loop data being lost yet. **Revised plan: build the rest of the portal first** (Foundation/RBAC → Gym CRUD + data-quality → owner-submission review queue + its `owner_submissions` backend → moderation → metro/pipeline ops → monetization when relevant), and **circle back to analytics LAST — instrument it as the final pre-launch step**, once the analytics tooling (PostHog vs Plausible vs self-host) is chosen alongside the product decision. The "instrument-now-or-lose-it" warning becomes the **launch gate**: analytics must be live *before* the first real users arrive, not before. Everything else in Sections 5–6 stands; only analytics moves from MVP-first to pre-launch-last.

---


**Operator:** Zach (single admin today; structured for a tiny team later). **Mount:** one `/admin` route subtree. **Stack:** reuse the existing Next.js (App Router, RSC) + Supabase (Postgres + RLS + edge functions + Storage) stack — no new infra. **Inviolable:** the provenance ladder (`owner > scout_verified > user > scraped > seed/osm/city_data > estimated`) and the never-fabricate rule are first-class UI constraints; a human always clicks the button that writes to a trust tier — nothing auto-publishes at `owner`/`scout_verified`.

---

## 1. PURPOSE & PRINCIPLES

The portal is Scout's **internal control surface** — the single place Zach runs the product instead of editing it via chat, raw SQL, and loader scripts. It replaces seven ad-hoc workflows with one cockpit: catalog CRUD + data-quality, owner-submission review, metro expansion & pipeline ops, community moderation, growth analytics, monetization, and system/RBAC.

**Principles (binding, not aspirational):**

1. **Reuse the stack.** Server-gated RSC routes under `/admin`; reads reuse `src/lib/queries/gyms.ts` (`assembleGym()`/`joinGyms()`) and the label/enum maps in `src/lib/types/scout.ts`. No new client framework, no new datastore. Mutations go through `security definer` RPCs or service-role-backed Route Handlers gated on a staff check — never broad client write-RLS on the catalog.
2. **Provenance is sacred.** Every fact editor exposes `source` + `confidence`. Hand-entry defaults to `scout_verified` (the operator *is* Scout verifying). Inference must be deliberately downgraded to `estimated` (≤0.7). Lowering a higher tier requires a confirm. `null` is a first-class, one-click "Unlisted" state — never a placeholder that reads as data.
3. **Never auto-publish to a trust tier.** Owner submissions, fact promotions, and pipeline candidate promotions all require a human decision. A bad extraction must never poison the top of the ladder.
4. **Audit everything.** Every mutation writes an append-only log row in the same transaction. The audit trail is the trust backbone and the precondition for ever adding a second person.
5. **First-party truth.** Analytics dual-writes to an owned Supabase `analytics_events` table even when PostHog is the analysis layer. KPIs live on owned ground.
6. **Forbid illegal states in the UI.** Monetization makes Partner-before-Scout+, charging-before-the-gate, and any take-rate field require a deliberate schema change, not a toggle.
7. **404, not 403.** Non-staff hitting `/admin` get a 404 (server-side), never a redirect or a 403 that advertises the surface.

---

## 2. INFORMATION ARCHITECTURE

The eight source designs collapse into **eight top-level sections** — not eight silos, but a real IA organized by *what Zach is doing*, with cross-links where areas meet. The shared shell (left nav, top status strip, environment + monetization-state badge) is owned by **System** and rendered on every screen.

| Section | What it answers | Absorbs from source areas |
|---|---|---|
| **Dashboard** | "Is everything OK right now?" | The `/admin` home tiles every area contributes — system health, queue depth, loop pulse, revenue, demand |
| **Gyms** | "Edit the catalog; fix data quality" | gym-data (CRUD, inspector, data-quality, merge, bulk) + moderation's *fact* corrections/promotions (community signal feeds the catalog) |
| **Submissions** | "Review what owners sent before it goes live" | review-queue (owner-queue, per-fact diff, publish, invites) |
| **Metros & Pipeline** | "Size markets, run the data pipeline, keep data fresh & live" | pipeline-ops (metros, candidates, freshness/liveness, runs) |
| **Community** | "Moderate UGC; manage users" | moderation (reviews, photos, users, bans) — *fact* moderation lives in Gyms, *content* moderation lives here |
| **Growth & Analytics** | "Is the loop real? Where's demand? What's the funnel?" | analytics (pulse, retention, search intel, funnels, demand, acquisition, event health) + content-comms (curation/SEO signal feeds here) |
| **Monetization** | "Run subs, partners, badges, revenue — without a take-rate" | monetization (billing, partners, revenue) |
| **System** | "Auth, roles, audit, flags, secrets, edge/DB health" | auth-ops (RBAC, audit, flags, secrets, ops console) + content-comms (blog/newsletter/SEO assets as a **Content** sub-area) |

**Two deliberate IA decisions worth calling out:**

- **Content/Comms is split, not its own top-level silo.** Its *signal* (search-log demand, zero-result clusters, chip promotion) belongs to **Growth & Analytics**; its *publishing surfaces* (blog, newsletter, alerts, SEO assets, curation) live under **System → Content** because they're operator-config, low-frequency, and share the Resend/webhook/suppression infra with Submissions' outreach. This avoids a thin eighth tab and puts the demand signal where the "what to build next" decision is made.
- **Moderation is bifurcated by target.** *Fact* corrections/confirmations (community telling you the catalog is wrong/right → ladder promotion) live in **Gyms** next to the data they change. *Content/user* moderation (reviews, photos, bans) lives in **Community**. Both write to their respective `*_fact_log`/`moderation_log`, which reconcile in System → Audit.

**Cross-links (the IA's connective tissue):** a zero-result query cluster in Growth deep-links to "create a scrape job" in Metros & Pipeline; a confirmation conflict in Gyms surfaces from Community signal; a published owner submission flips badges read by Monetization; the Partner-conversion funnel in Growth reads Submission status transitions; demand in Growth ranks the next metro in Pipeline.

---

## 3. SCREEN INVENTORY

### Dashboard
- `/admin` — Operator home: composite tiles (system health green/amber/red, review-queue depth + oldest age, loop pulse MAU/WAU, funnel snapshot, revenue/MRR, open demand signals, last pipeline run, P2-gate readiness), each deep-linking into its section.

### Gyms
- `/admin/gyms` — Master table: cross-city, sortable/filterable, provenance + completeness + lifecycle columns, bulk-select.
- `/admin/gyms/[id]` — Inspector: every fact + source + confidence + detail, sectioned per `assembleGym()`; inline edit; provenance strip; map pin; membership-plan matrix editor; Audit tab; Community tab (reviews/visits/follows/confirmation rollup, read-only).
- `/admin/gyms/new` — Add gym: name → auto-geocode → progressive fact editors; defaults `scout_verified`.
- `/admin/gyms/merge` — Dedupe: fuzzy-name + PostGIS proximity candidates; side-by-side diff; transactional re-parent + tombstone; confirm-by-typing-slug.
- `/admin/gyms/bulk` — Bulk edit: set city/segment/amenity/status/verified across N; preview-diff before commit.
- `/admin/data-quality` — Cockpit: provenance distribution, low-confidence queue, coverage/price gaps, staleness, confirmation conflicts, freshness diff inbox, city-tier board.
- `/admin/gyms/facts` — Fact moderation: accept-correction / reject / promote-confirmation / escalate-to-scout-verify (the ladder engine; from moderation's Facts screen).

### Submissions
- `/admin/owner-queue` — Submission list: filterable table, sorted conflicts-desc then oldest; bulk auto-approve (≥0.98 all-MC, zero-conflict only).
- `/admin/owner-queue/[id]` — Per-fact diff & review: header (contact, invite provenance, transcript), per-fact diff table with provenance-aware default action, five per-fact actions, decision footer (badge preview, Publish / Reject / Request-info).
- `/admin/invites` — Tokenized invite management: mint / re-issue / revoke / resend; bulk-mint per city; show full link once, store only `sha256`.

### Metros & Pipeline
- `/admin/metros` — Metro list: per-city ops columns (gym count, provenance mix, completeness %, freshness, last run, spend, demand rank); Add metro, guarded tier promotion.
- `/admin/metros/[slug]` — Metro cockpit: Overview (coverage map) / Pipeline (stage runner) / Candidates (`facility_candidates` review grid) / Freshness / Cost.
- `/admin/freshness` — Cross-metro liveness: monthly Overture/FSQ diff queue, closed-gym review, stale-fact sweep.
- `/admin/demand` — Expansion waitlist: uncovered-metro searches ranked, one-click "Size this metro."
- `/admin/runs` — Pipeline run history / job monitor.

### Community
- `/admin/moderation` — Moderation dashboard: triage buckets + 7-day volume sparkline (brigading signal).
- `/admin/moderation/reviews` — Review queue: reported/hidden filter, detail drawer, hide/restore/approve/delete/redact/strike.
- `/admin/moderation/photos` — Photo queue: review_photos + user/owner gym_photos; approve/reject/restore/retag/bulk.
- `/admin/moderation/users` — Per-user moderation: ban/unban/strike/hide-all (email via `admin_user_lookup` RPC only).

### Growth & Analytics
- `/admin/analytics` — Pulse: KPI strip, loop funnel mini, P2-gate readiness callout.
- `/admin/analytics/retention` — DAU/WAU/MAU + weekly retention cohort grid + per-feature stickiness.
- `/admin/analytics/search` — Search intelligence: parse-success %, top queries, zero-result clusters, weak-match, voice/typed split.
- `/admin/analytics/funnels` — Discovery→Save→Travel, Scout+ conversion, Partner conversion; segmentable.
- `/admin/analytics/demand` — Uncovered-metro demand ranking + heat map (shares data with `/admin/demand`).
- `/admin/analytics/acquisition` — Traffic/referrers/SEO + newsletter growth + launch-list size.
- `/admin/analytics/events` — Event health: volume by type, last-seen per event, PostHog↔Supabase reconciliation, data dictionary.

### Monetization
- `/admin/revenue` — Finance home: MRR/ARR (Scout+ vs Partner stacked), P2-gate panel, conversion funnels, comps exposure, dunning alerts.
- `/admin/billing` — Subscriptions (unified Scout+/Partner): lifecycle drawer (comp/refund/cancel/pause/grandfather-batch), Stripe sync.
- `/admin/partners` — Partner accounts: badge + bounded `partner_boost` slider, entitlements, partner-analytics QA mirror.
- `/admin/partners/[gym]/analytics` — Partner-facing analytics builder/QA (attribution counts only, never take-rate).

### System
- `/admin/system/edge` — Edge & functions status + live ping.
- `/admin/system/database` — DB advisors, migration-drift ledger, RLS coverage map.
- `/admin/system/secrets` — Secret-rotation board (status only, never values).
- `/admin/system/storage` — Bucket usage, orphan scan, backup readback.
- `/admin/audit` — Global append-only audit timeline (reconciles `admin_audit_log` + `owner_fact_log` + `moderation_log`).
- `/admin/flags` — Feature flags & runtime config (kill-switches, rate limits, OAuth providers).
- `/admin/access` — Staff & roles: grant/revoke, sessions, force sign-out.
- `/admin/security` — Operator's own posture: MFA, sessions, sign-in feed.
- **System → Content** (sub-section): `/admin/content/blog`, `/admin/content/newsletter`, `/admin/content/subscribers`, `/admin/content/alerts`, `/admin/content/seo`, `/admin/content/curation`.

---

## 4. TECH & AUTH APPROACH

**Route subtree.** Everything under `src/app/(admin)/admin/*` — a route group with its own server-component layout. One `requireStaff(minRole)` call in the layout reads the session server-side and **404s** non-staff. No public nav link.

**RBAC — one primitive, built once, reused by all eight areas.** The seven designs proposed three variants (`profiles.role`, `admin_users`, `staff_members`). **Resolution: a dedicated `staff_members` table** (cleaner than overloading `profiles`, supports tiers) + an `app_metadata.role` mirror for fast JWT/middleware checks. Roles: `owner` (Zach — everything incl. role grants, billing config, kill-switches), `admin` (full data/queue/ops, no role/billing grants), `reviewer` (queue + moderation only), `viewer` (read-only dashboards). Predicates `is_staff()` / `has_role(min_role)` are `security definer stable set search_path=''`, called in every admin RLS policy and every admin RPC guard. Roles live in `app_metadata` (server-controlled), **never** `user_metadata` (user-writable = privilege escalation). Destructive actions (publish, role grant, kill-switch, secret-rotation ack) require a fresh/`aal2` MFA session.

**Write model.** RLS stays public-read / owner-scoped as today. Admin mutations go through **`security definer` RPCs** (for transactional/audited actions: merge, publish, promote, ban, role-grant) plus **service-role-backed Route Handlers gated on `is_staff()`** (for simple scalar/fact edits) — never a broad client write-RLS on the catalog. Insert-only tables (`search_logs`, `email_subscribers`, `analytics_events`) keep their posture; admin reads go through `security definer` aggregation RPCs so raw rows (queries, emails) never reach the client.

**Consolidated new backend across the whole portal:**

*Foundation (blocks everything):*
- `staff_members` + `is_staff()`/`has_role()` + `app_metadata` mirror (edge fn for the `auth.users` write).
- `admin_audit_log` (append-only) + shared `logAdminAction()` wrapper.
- `app_config` (feature flags/runtime config) + `secret_rotations`.

*New columns on existing tables:*
- `gyms`: `status`/lifecycle (`active|closed|moved|duplicate|unverified_new`) + `status_note`/`status_changed_at`; **OR** the pipeline's `liveness`/`closed_at`/`closed_source` + `last_fetched_at`/`last_extracted_at` — **reconcile these two proposals into one `status`/lifecycle column set** (open decision below); badge booleans `owner_listed`/`gym_verified`/`is_partner`; `partner_boost numeric` (bounded, read by `scorer.ts`).
- `gym_reviews`: `status`, `moderated_by/at`, `moderation_reason`.
- `review_photos` + `gym_photos`: `moderation_status`, `moderated_by/at`.
- `search_logs`: `city_slug`, `city_covered`/`anon_id`, `input_mode` (voice/typed), `session_id` — **the one small MVP-blocking add that unlocks demand + search analytics.**
- `cities`: `bbox`, `status` (demand→live lifecycle), `attribution_note` (Overture/FSQ/OSM credit — **legal requirement**).
- `email_subscribers`: `status`, `confirm_token_hash`, `confirmed_at`, `unsubscribed_at`, `source`, `city_slug`.

*New tables:*
- **Submissions:** `owner_invites`, `owner_submissions`, `owner_fact_log`, `outreach_events`, `outreach_suppressions`.
- **Catalog ops:** `gym_edit_log` (mirrors `owner_fact_log` shape so timelines unify).
- **Pipeline:** `facility_candidates`, `pipeline_runs`, `pipeline_cost_ledger`, `metro_sizing`, `metro_demand` (can be a materialized view), `page_cache` (index), `closure_events`.
- **Moderation:** `review_reports`, `user_moderation`, `moderation_log`, `fact_moderation_log`.
- **Analytics:** `analytics_events` (the keystone first-party event spine), `expansion_demand`, `kpi_targets`, `admin_saved_views`, `event_registry`.
- **Monetization:** `billing_customers`, `subscriptions`, `stripe_events`, `partner_entitlements`, `partner_attribution` (view over events), optional `comp_grants`.
- **Content:** `blog_posts`, `newsletter_campaigns`, `newsletter_sends`, `gym_change_events`, `alert_sends`, `curated_chips`, `curated_collections`, `seo_assets`.

*New RPCs (`security definer`, staff-gated, audit-in-txn):* `admin_merge_gyms`, fact-upsert-with-rank-guard, `publish_owner_submission`, `moderate_review`/`moderate_photo`, `accept_fact_correction`/`promote_fact_confirmation`, `ban_user`/`unban_user`, `admin_user_lookup`, `grant_staff_role`/`revoke_staff_role`, `set_config`, `ack_secret_rotation`, `admin_metrics` + the analytics aggregation RPCs (`admin_search_summary`, `admin_funnel`, `admin_retention_cohorts`, `admin_demand_leaderboard`, `admin_kpi_snapshot`).

*New edge functions:* `admin-ops` (Management API bridge: advisors, migrations, edge status, storage, + the `app_metadata` role write); `owner-parse` + `owner-portal` (Submissions); `send-newsletter`/`send-alerts`/`resend-webhook`/`confirm-subscription` (Content); Stripe webhook handler (Monetization).

**Reuse vs build.** *Reuse:* `assembleGym()`/`joinGyms()` read path; `scout.ts` enum/label/`PROVENANCE_META` maps (never re-declared — the recurring "sixth surface" drift bug); `geocode.mjs` consensus logic server-side; `confirmation_counts()` RPC; existing MapLibre + Signal Pin for coverage maps; the `get_secret`/Vault pattern; the auth-callback PKCE/session-read for the guard; the `ai-search` edge-fn posture (apikey gate, Vault secret, curl-after-deploy). *Build:* the RBAC primitive, every mutation path, the event spine, Stripe, the pipeline backend, the send infra. **Every migration must mirror Row/Insert/Update + enum `Constants` into `src/lib/types/database.ts` in the same commit** (the documented recurring drift bug).

**Cross-surface watch-items baked in:** `status`/liveness filtering is a **public-app change** (`fetchCityGyms` must hide/relabel non-active gyms) — not a FilterSet field, so the four-surface contract isn't triggered, but it's load-bearing. `partner_boost` *is* a scorer surface → lands with the scorer change (four-surface discipline). `open_24h` lives in both `gyms.hours` and `gym_amenities` (and `parking` mirrors `gym_parking`) — editors must keep both in sync. PostgREST returns numerics as strings → `Number()`-coerce on read-back. **Bug to fix in MVP:** `report_review()` auto-hides at 3 reports but never calls `refresh_gym_rating()`, so a brigaded review keeps polluting the average — `moderate_review()` must always refresh, and patch the auto-hide path too.

---

## 5. MVP — THE FIRST SLICE (and the argument for it)

**The MVP is three things on top of one foundation:**

> **(0) RBAC + `/admin` shell + audit log** → **(A) Analytics instrumentation** + **(B) Owner-submission review queue** + **(C) Gym data CRUD & data-quality cockpit.**

**Why these three, in this order, are the highest-leverage first slice — the hypothesis holds, with one sequencing refinement:**

1. **The foundation (0) is unavoidable and tiny.** Six of seven areas independently concluded the same thing: nothing admin exists, and a one-migration RBAC primitive + a 404-gated route group + an audit table blocks *everything else*. It's the cheapest unlock in the entire portal. Build it once.

2. **(A) Analytics instrumentation is the binding P2 gate and is time-sensitive in a way nothing else is.** Every downstream monetization and expansion decision rests on an *unmeasured* loop. Because beta is deliberately auth-less and saves live in localStorage, the discovery→save→travel funnel **structurally cannot be reconstructed from existing tables** — it must be instrumented *now* or the data is gone forever. **Search Intelligence is nearly free today** (the data is already in `search_logs`; it only needs an admin read path + 3 small columns), delivering immediate value while the PostHog SDK + `analytics_events` dual-write spine + ~8 events get wired. This is the only MVP piece where *delay destroys data*, so it ranks first.

3. **(B) The owner-submission review queue is the highest-value *new product capability* — and its dependency chain makes it the natural next build.** It's the human gate that lets a real owner submission publish at `owner` tier safely — the partner funnel's entire reason to exist. Crucially, the queue is **blocked on the `owner_submissions` backend** (the five tables + `publish_owner_submission` RPC + `owner-parse` edge fn), which is **the natural next build anyway** — it's the on-ramp from the data pipeline to monetization, and the RBAC foundation it needs is already item (0). Building the backend unblocks both the queue *and* the Partner-conversion funnel in (A). So (B) isn't a detour; it's the load-bearing middle of the whole portal.

4. **(C) Gym data CRUD + the data-quality cockpit replaces ~80% of the "query the DB / run a loader / edit via chat" workflow with zero risk** for the read-only half — the master table, inspector, and data-quality dashboard are **buildable today on the current schema**. The write half (scalar/fact edits behind staff-gated Route Handlers, with the never-fabricate "Unlisted" affordance, the rank-override guardrail, geocode-fix, add-gym, mark-closed) is the daily-driver that ends SQL surgery. This is the operator's most-used surface.

**The argument in one line:** (0) unblocks everything for almost nothing; (A) must happen *this week or never* because the loop is auth-less; (B) is the highest-value new capability *and* its prerequisite backend is the portal's structural keystone; (C) is the highest-frequency daily tool and is half-free today. Everything else — merge, bulk, full moderation tooling, the pipeline runners, Stripe, the send infra — is gated on volume, on the pipeline backend, or on a *measured* loop, and correctly waits.

**Explicitly deferred out of MVP:** merge/dedupe (dangerous, gated on two metros overlapping), bulk edit, photo CRUD, confirmation-conflict resolution at scale (gated on real UGC volume), the pipeline run buttons (gated on `scripts/*.mjs` landing), Stripe/billing (gated on the measured loop), newsletter/alert sends (gated on Resend domain + the freshness loop), full role tiers + MFA enforcement.

---

## 6. PHASES

| Phase | Contents | Gate / trigger to enter |
|---|---|---|
| **MVP (Phase 1)** | (0) `staff_members` + `is_staff()`/`has_role()` + `/admin` 404-gate + `admin_audit_log` + `app_config`; secret-rotation board; `admin-ops` edge fn (advisors/migrations/edge/storage on Dashboard). (A) PostHog SDK + `track()` dual-write + `analytics_events` + ~8 events + `search_logs` columns; Pulse + Search Intelligence screens; admin read path on `search_logs`. (B) `owner_submissions` migration (5 tables + badge cols + `publish_owner_submission` + tighten owner-photos policy); `/admin/owner-queue` list + per-fact diff; minimal invite mint/revoke/copy. (C) Gym master table + Inspector (read, reuses `assembleGym()`); Data-Quality dashboard; scalar+fact editing via staff-gated Route Handlers writing `gym_edit_log`; geocode-fix; add-gym; `gyms.status` + mark-closed. Plus moderation MVP: `gym_reviews` mod columns + `review_reports` + `moderate_review()` (always `refresh_gym_rating`) + basic audit screen + `user_moderation`/ban + `is_banned()` RLS clause. | **Now.** This is the beta build. No external gate — it's the precondition for measuring the P2 gate and for any real owner/partner flow. |
| **v2 (Phase 2)** | Gyms: bulk edit, photo CRUD, membership-plan structured editor, confirmation-conflict resolution. Submissions: bulk auto-approve, full funnel/outreach health, bulk-mint + 3-touch sequence, `needs_info` round-trip. Pipeline: `facility_candidates` + discovery/fetch/extract runners + cost ledger + candidate grid + acceptance-test harness. Analytics: retention cohorts + Funnels (first-party) + Demand/`expansion_demand` + Partner-conversion funnel + KPI targets/gate scorer. Monetization: **Stripe Billing — Scout+ first, then Partner** + `/admin/billing` lifecycle + `/admin/partners` convert flow + partner analytics + `/admin/revenue`. Content: `blog_posts` + fact-linting; newsletter MVP + Resend webhook + suppression + double-opt-in; curated chips. Community: photo moderation, fact-promotion RPCs, brigading detection. System: full role tiers + grant UI + MFA enforcement + flag-driven kill-switches. | **Multiple gates, area-specific:** Monetization gated on a **measured consumer loop clearing PLAN's beta-success thresholds** (the whole point of MVP-A) — and Partner strictly *after* Scout+. Pipeline runners gated on **`scripts/*.mjs` discovery/fetch/extract landing**. Newsletter/curation gated on **production Resend domain verified**. Fact-promotion + brigading gated on **real UGC volume** (confirmations clustering, reviews being reported). |
| **Later (Phase 3)** | Pipeline: monthly Overture/FSQ diff → freshness queue + re-enrichment triggers (rank-guarded); Stage-0 sizing automation. Submissions/Monetization: Partner-tier billing maturity, referral bounties (gym-as-advertiser only), second Partner tier. Analytics: session-replay triage, anomaly alerts, weekly digest, A/B flags, LTV/cohort-revenue. Content: change/new-gym alert pipeline (`gym_change_events` + diff producer), curated-collection SEO landing pages, OG-card studio. System: DB-side audit triggers, advisor-diff snapshots, reconciled `admin_audit_log`+`owner_fact_log`+`moderation_log` timeline, second teammate seats actively used. Gyms: trigger-enrichment-from-UI; unify `gym_edit_log`+`owner_fact_log`. | **Gated on:** the **metro pipeline being industrialized** (the freshness cron / diff feed must run, not be hand-driven) before alerts/freshness-diff; **revenue existing** before LTV/referrals/second tier; **a second person joining** before role tiers and per-actor audit filtering earn their keep. |

---

## 7. OPEN DECISIONS FOR ZACH

1. **Lifecycle column reconciliation (must resolve before MVP-C).** gym-data proposed `gyms.status` (`active|closed|moved|duplicate|unverified_new`); pipeline-ops proposed `gyms.liveness` (`open|suspect|closed|reopened`) + `closed_at`/`closed_source`/`last_fetched_at`/`last_extracted_at`. These overlap. **Recommendation:** one unified `status` enum covering both vocabularies (`active|suspect|closed|moved|duplicate|unverified_new`) + the freshness timestamps as separate columns. Pick the enum values now — it's a public-app-visible change and shouldn't be migrated twice.
2. **Analytics tooling.** Confirm PostHog Cloud (primary) + the `analytics_events` dual-write, with Plausible/PostHog-web for traffic. The dual-write is non-negotiable per the first-party rule; the question is only whether to add Plausible or let PostHog-web subsume it.
3. **Beta grandfathering policy** (`comp_type`): free-forever vs lifetime-discount vs 1-yr-free. The UI supports all three; you pick the policy before Scout+ billing ships. Define the cohort (users created before launch) now even though billing is P2.
4. **Bulk auto-approve threshold for owner submissions.** Confirm `≥0.98 confidence, all-multiple-choice, zero-conflict` as the only auto-approvable class — and whether to enable it in MVP or defer to v2 (recommend defer; volume doesn't justify it at 35 gyms).
5. **Content/Comms placement.** Confirm the IA decision to fold Content under System and route its *signal* into Growth — vs giving it a top-level tab. (Recommend the fold; revisit if content velocity becomes a primary workflow.)
6. **`llms.txt`/`robots.txt`:** keep as static files (edit = deploy) or move to `seo_assets` + a route handler (no-deploy). Recommend `seo_assets` once `/admin/content/seo` exists; static is fine until then.
7. **Reviewer-role scope.** Confirm that `reviewer` = owner-queue + community moderation only, can't grant roles/touch billing/override another reviewer — and that MFA enforcement (rejecting `aal1` writes) is v2, not MVP (enrollment in MVP, enforcement later).
8. **P2-gate thresholds.** The Pulse screen grades the loop against PLAN's beta-success signals (search→detail→save completion, NL parse ≥80%, shortlist+compare ≥30% of sessions). Confirm the exact numeric bar that flips the gate green.

---

## 8. ROUGH EFFORT READ

Relative sizing for a solo operator working with agents; "unit" ≈ a focused day. Ranges reflect read-only-vs-mutation split.

| Phase / block | Effort | Notes |
|---|---|---|
| **MVP — Foundation (0)** | **S (2–3 units)** | One migration (`staff_members`, `is_staff`/`has_role`, `admin_audit_log`, `app_config`, `secret_rotations`) + route group + guard + `admin-ops` edge fn. Small, additive, breaks nothing. |
| **MVP — (A) Analytics** | **M (4–6 units)** | Search Intelligence is ~1 unit (data exists). The bulk is PostHog SDK + `track()` dual-write + `analytics_events` + instrumenting ~8 events at real call sites + Pulse screen. The event wiring is the long pole. |
| **MVP — (B) Review queue** | **L (6–9 units)** | The backend is greenfield: 5 tables + `publish_owner_submission` (transactional, parking re-sync, badge logic) + `owner-parse`/`owner-portal` edge fns + the diff-table UI. Can't be end-to-end-tested until `owner-parse` produces real `parsed_facts`. Largest MVP block. |
| **MVP — (C) Gym CRUD + DQ** | **M–L (5–8 units)** | Read-only half (master table, inspector, DQ dashboard) is ~2 units reusing `assembleGym()`. Write half (Route Handlers, every fact editor, guardrails, geocode-fix, add-gym, `status` column + public-app filter) is the rest. Highest screen count. |
| **MVP — Moderation slice** | **S–M (2–4 units)** | Mod columns + `review_reports` + `moderate_review()` (the `refresh_gym_rating` bug fix) + ban + audit screen. Genuinely small because volume is near-zero, but a single abusive review is real day-one risk. |
| **MVP total** | **~5–6 weeks solo** | Sequence: (0) → (A-search + spine in parallel) → (B-backend, which also unblocks the Partner funnel) → (C) → moderation. |
| **v2 — Stripe/billing** | **L (8–12 units)** | Stripe Billing + webhooks + 4 tables + dunning + 4 screens. Gated on the measured loop, so no rush. |
| **v2 — Pipeline runners** | **L (10–15 units)** | Gated on `scripts/*.mjs`; design now, wire as each lands. Cost ledger + candidate grid + acceptance harness. |
| **v2 — Analytics graduation + Content sends** | **M–L (6–10 units each)** | Retention/funnels off PostHog-embed; newsletter/blog + Resend send infra. |
| **v2 total** | **~2–3 months, paced by gates** | Each block enters only when its gate trips; not a single sprint. |
| **Phase 3** | **Ongoing** | Industrialized pipeline freshness, alert pipeline, revenue maturity, second-seat tooling. Triggered by infra maturity / revenue / team growth, not a deadline. |

**Critical-path read:** the MVP's long pole is **(B) the owner-submission backend** — it's the largest single block *and* the structural keystone that unblocks the partner funnel. Start (0) and the (A) search/spine work in parallel immediately (they share no dependencies), land the (B) backend next (it's the natural next build), then (C) and the moderation slice. That ordering gets the data measured this week, the partner gate instrumented, and SQL surgery retired — in roughly five to six solo weeks.