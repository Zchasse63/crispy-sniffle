@AGENTS.md

# Scout — agent guide

AI-powered gym discovery. Tampa beta (35 gyms, rich tier) + Miami (basic tier,
honestly labeled). Live at https://scout-gym.netlify.app — Netlify auto-deploys
`main` (~75s). Supabase project `hblldqsccjpiikbhyknd` (Postgres + PostGIS +
Auth + Storage + Vault + Edge Functions). Product plan and phase gates live in
[PLAN.md](PLAN.md); research that backs decisions in `docs/research/`.

## Non-negotiables

1. **"Done" = executed and observed.** A flow counts only after it ran in a
   real browser / against the live DB. Files written ≠ done.
2. **Never fabricate data.** Unknown prices stay null and render "unlisted."
   Inferences are `estimated` with confidence ≤ 0.7 and visible badges. We'd
   rather say unknown than make something up.
3. **THE KODAWARI RULE.** Segment labels and vibes are SOFT (boost, never
   exclude); equipment is ground truth. Training intents must union defining
   equipment (`SEGMENT_CAPABILITIES`). A yoga studio with a cold plunge is not
   a lifting gym.
4. **The FilterSet contract has four surfaces** — rail UI (`filterStore`),
   fallback parser (`lib/search/nlParser.ts`), edge function
   (`supabase/functions/ai-search`), scorer (`lib/scoring/scorer.ts`). Any
   FilterSet change lands on ALL FOUR in the same commit, plus
   `lib/search/synonyms.ts` and an edge redeploy.
5. **One implementation per concern.** Shared labels/types live in
   `src/lib/types/scout.ts` (AMENITY/SEGMENT/EQUIPMENT/VIBE labels). Never
   re-declare a label map in a component.
6. **Scoring is deterministic and explainable** (`scorer.ts`). The LLM only
   parses language into a FilterSet — never scores, never invents reasons.
7. **Icons:** lucide-react for general UI. Gym-type (segment) icons use the
   curated **Twemoji** set — bundled as base64 data-URIs in
   `src/lib/segmentIcons.ts` (regen via `scripts/gen-segment-icons.mjs`), so the
   UI needs no icon CDN. Never raw OS emoji — always the shipped Twemoji SVGs.
8. **Community data is first-party only.** Outbound discussion links with our
   neutral `topic_note` are fine; NEVER ingest Google/Yelp/ClassPass content.
   Mapbox/Google POI data is display-only; OSM is storable (ODbL, attribute it).

## Architecture map

- `src/app/` — App Router; gym detail at `gym/[slug]` (RSC, force-dynamic);
  auth callback `app/auth/callback/route.ts` (PKCE exchange + same-origin
  `?next` guard via URL constructor — keep it that way).
- `src/lib/types/database.ts` — generated-from-schema types, currently
  hand-maintained: after any migration, mirror Row/Insert/Update AND the
  `Constants` arrays (two sites per enum — missing one is a recurring bug).
- Stores: zustand + persist + `skipHydration`; `HydrationGate` rehydrates then
  mounts `AuthGate` (order prevents a data-loss race — don't reorder).
  Signed-in mutations cloud-sync (e.g. `tripStore.cloudSync` on city+dates
  tuple; ids legitimately diverge local vs cloud).
- Auth: magic link + password + env-gated SSO (`NEXT_PUBLIC_OAUTH_PROVIDERS`);
  modal portals to `document.body` (sticky-header backdrop-filter clips fixed
  overlays — IF-01). `proxy.ts` (root) is the middleware: this Next version
  runs it in dev but emits no bundle in prod builds; browser-side refresh
  covers sessions.
- Edge fn `ai-search`: verify_jwt=false BY DESIGN (publishable keys aren't
  JWTs); apikey-header gate + per-isolate rate limit (20/min/IP) + 300-char
  cap; Anthropic key via Vault `get_secret()` RPC (service-role only).
- Provenance ladder: owner > scout_verified > user > scraped > seed/osm/
  city_data > estimated, each with confidence. `AttributeSection` summarizes a
  ≥80% dominant source at section level; low-confidence rows always badge.

## Workflows

**Validate** (long commands via detached-nohup — direct backgrounding has
dropped completions before):
```sh
nohup sh -c 'cd <repo>; npx tsc --noEmit > /tmp/v.log 2>&1; echo "TSC=$?" >> /tmp/v.log; \
  npm run build >> /tmp/v.log 2>&1; echo "BUILD=$?" >> /tmp/v.log; echo DONE >> /tmp/v.log' &
# then a background `until grep -q DONE /tmp/v.log; do sleep 3; done` waiter
```

**E2E**: `npx playwright test` (config: port 3100, reuseExistingServer,
`workers: 3` — the edge rate limit + dev cold-compiles make 6 workers flaky).
POMs in `tests/pages/`, specs per surface in `tests/e2e/`. Documented traps
(see `specs/bugs/`, healing logs): never `.textContent()` on possibly-absent
elements (30s auto-wait each — use `count()`/`allTextContents()`); never
multi-Page fixtures in one test (last `goto` wins); AI-dependent specs stay
`mode: "serial"`. Stop dev servers/browsers when verification ends.

**Data loaders** (`scripts/*.mjs`, need `.env.local` with service-role key):
seed → enrich → geocode → parking-enrich → decision-enrich → vision-enrich →
machine-load / womens-load. All re-runnable; gym-published facts are
`scraped` 0.85 and override `estimated`; loaders must coerce PostgREST numeric
wire-strings with `Number()`.

**Migrations**: apply via Supabase MCP `apply_migration`, then mirror the SQL
into `supabase/migrations/` and update `database.ts` + `scout.ts` types in the
same commit.

**Edge deploys**: `deploy_edge_function` requires the FULL `index.ts` content
— a partial/"PLACEHOLDER" deploy once broke prod for ~70s. Live-test with a
curl POST after every deploy.

**Supabase config (not data)** — redirect URLs, SMTP, OAuth providers — is the
Management API (`api.supabase.com`), token `SUPABASE_ACCESS_TOKEN` in
`.env.local`. Use curl or Node fetch: python-urllib's UA is Cloudflare-blocked
(error 1010). `scripts/enable-oauth.mjs` flips SSO once console creds exist.

## Gotchas that have actually bitten

- Tracked-file edits: if the Edit tool reports a conflict, re-Read and Edit —
  bash-side writes to those files get silently reverted by state reconciliation.
- Don't run two builds/tsc concurrently — `.next` lock contention produces
  bogus failures; `rm -rf .next` clears phantom "* 2.ts" type-stub errors.
- Census geocoder + plausibility cap (≤3km move) for coords; never trust one
  geocoder alone (Nominatim once agreed on Denver for a Tampa gym).
- Overpass API: batch queries, expect 429s, sleep between calls.
- `hours` close time "00:00"/"24:00" means end-of-day — `isOpenNow` in
  `scorer.ts` is the single source of hours truth; build on it, don't fork it.

## Secrets (never commit; `.env.local` is gitignored)

`SUPABASE_SERVICE_ROLE_KEY` (loaders only) · `SUPABASE_ACCESS_TOKEN`
(Management API PAT) · `RESEND_API_KEY` (also in Vault; test key = delivers
only to account owner) · `MAPBOX_SECRET_TOKEN` (server-only) ·
`NEXT_PUBLIC_MAPBOX_TOKEN` (public by design) · Anthropic key lives ONLY in
Supabase Vault. All chat-shared keys are queued for post-beta rotation —
see `docs/launch-checklist.md`.
