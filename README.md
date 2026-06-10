<p align="center">
  <img src="src/app/icon.svg" width="84" alt="Scout — Signal Pin" />
</p>

# Scout — Find your fit.

**AI-powered gym discovery.** Scout scans the landscape of gyms and surfaces the right fit for you — the equipment, amenities, and hours that actually matter. Type it or say it: *"squat racks and a sauna with dumbbells over 100 lbs."*

**Status: Phase 1 web beta · Tampa, FL** (32 web-verified gyms, rich data tier) + Miami (basic tier, honestly labeled).

**Live: [scout-gym.netlify.app](https://scout-gym.netlify.app)** — auto-deploys from `main` via Netlify CI.

## How it works

- **AI as a layer over real filters.** A natural-language query — *"vibey yoga studio"*, *"gym with hip thrust machines"*, *"trendy and instagram friendly"* — is parsed into a structured `FilterSet` by Claude via the `ai-search` Edge Function, with a built-in keyword parser as transparent fallback. The app never hard-depends on the LLM.
- **Deterministic, explainable matching.** Scores (0–100) come from weighted attribute coverage in `src/lib/scoring/scorer.ts` with per-gym reasons and honest misses. Vibes and AI-inferred facility types only ever *boost* — equipment is ground truth and labels never satisfy a training intent (the Kodawari rule).
- **Provenance everywhere.** Every fact carries `source` (owner → scout_verified → user → scraped → seed/OSM → estimated) + confidence, surfaced as badges. Unknowns say *unlisted*; inferences say *Estimated*.
- **Decision intelligence.** Real day-pass/membership pricing with break-even math, drop-in policy ("walk in" vs "book first" vs "members only"), parking recommendations (gym-stated + OpenStreetMap + honest inference), bike/transit access, open-now from real schedules.
- **Community + profile.** Magic-link sign-in, visit log with membership-vs-pass nudges from your own habits, reviews with moderation, curated outbound discussion links (never ingested content), cross-device saves/trips sync.
- **Voice = input method.** Web Speech API → transcript → the same search pipeline.
- **Travel mode (free in beta).** Trips match destination gyms against your filters and rank them by real drive time from your lodging (Mapbox Matrix).

## Stack

Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres 17 + PostGIS, RLS, Auth magic-link, Storage, Vault, Edge Functions) · Mapbox GL 3 with the custom **Scout Waypoint** map style + Isochrone/Matrix/Static APIs · zustand (persist + cloud sync when signed in) · lucide-react.

Brand: **Waypoint** design system (ink `#1C2B36` · blaze `#E1492F` · pool `#3E8E86` · contour `#C9BC9C` · paper `#F1ECDF`; Big Shoulders / Public Sans / IBM Plex Mono) with the **Signal Pin** mark.

## Run it

```bash
npm install
cp .env.example .env.local   # fill in Supabase URL + publishable key
npm run dev
```

### Seed the database (once per Supabase project)

Apply `supabase/migrations/*.sql` (in order), then:

```bash
# .env.local additionally needs SUPABASE_SERVICE_ROLE_KEY (server-only, never committed)
node scripts/seed.mjs
```

Seeds 32 web-verified Tampa gyms + 3 Miami gyms from `data/tampa-research.json` with per-field provenance. Enrichment pipelines (`scripts/enrich.mjs`, `parking-enrich.mjs`, `decision-enrich.mjs`, `vision-enrich.mjs`, `geocode.mjs`) layer scraped/OSM/vision facts over the seed with provenance-aware overrides — see each script's header.

### AI parsing configuration

The deployed `ai-search` function resolves its Anthropic key in this order:

1. `ANTHROPIC_API_KEY` function secret (`supabase secrets set ANTHROPIC_API_KEY=sk-ant-... --project-ref <ref>`) — wins if set
2. **Supabase Vault** (current production setup): the key is stored via `vault.create_secret('ANTHROPIC_API_KEY')` and read through the service-role-only `public.get_secret()` RPC

With neither configured, the function returns `503 NO_AI_KEY` and the client transparently falls back to the built-in parser ("Quick-parsed" instead of "AI-parsed"). To rotate the key: insert a new Vault secret with the same name (newest wins).

## Project docs

- [PLAN.md](PLAN.md) — the full phased plan: locked decisions, build rules (born from a prior iteration's forensics), Phase 1 scope, and the gated Phase 2 (booking + Stripe) / Phase 3 (gamification, portals) roadmap. iOS is a parallel track on this same backend.
- [docs/brand/](docs/brand/) — brand exploration history (Waypoint won).

## Honesty rules baked into the product

- Unknown prices say *unlisted* — never invented.
- Estimated facts say *Estimated* with confidence shown.
- Cities Scout hasn't mapped say *Limited data*.
- "Done" means executed and observed — every Phase 1 flow was verified in a real browser before merge.
