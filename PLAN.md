# Scout — Product & Build Plan

> **Scout** is an AI-powered gym discovery app. Its one job: **help people find the gym that actually fits them** — the right equipment, amenities, hours, vibe, and price. Beta market: **Tampa, FL**. Web beta first; native iOS follows on the same backend.

**Tagline:** *Find your fit.*
**Repo:** `Zchasse63/crispy-sniffle` · **Supabase:** `hblldqsccjpiikbhyknd` ("Scout Gym")

---

## Why this plan looks like this

A prior Scout (Nov 2025, `~/Developer/scout`) failed forensically — not on the idea, but on process: scope explosion (booking + payments + 2 portals + voice pipelines + gamification at once), self-certified "done" that was never executed, contract drift between generated layers (two gym ID spaces, three booking write paths with phantom columns), and UI polish generated on flows nobody had ever tapped through. This plan is the antidote: **one product loop, built narrow and verified deep.**

### Non-negotiable build rules
1. **"Done" = executed and observed**, never "files written."
2. **One working loop before breadth.** No new surface while a core flow is broken.
3. **DB types generated from the live schema.** One canonical gym ID space (uuid + slug).
4. **One implementation per concern.** No duplicate stores/parsers/validators.
5. **Real seed data from day one.** No `Math.random()` or hardcoded mocks inside "done" features.
6. **UI built in a render→inspect→adjust loop.** Real icon set (lucide) — never emoji-as-icons.
7. **Tests/verification gate on critical paths**, not vanity counts.

---

## Locked product decisions

| Decision | Choice |
|---|---|
| Core focus | Discovery & matching (NOT booking — that's Phase 2) |
| AI posture | **A layer over solid filters** — LLM parses language → structured filters; match scoring is deterministic and explainable |
| Voice | Just an input method: speech-to-text → same search pipeline |
| Travel | In Phase 1, **free during beta** (no paywall) |
| Auth | None in beta — shortlists/trips in localStorage |
| Market | Tampa (rich data tier); other cities visible as "basic" tier, honestly labeled |
| Brand | **Waypoint** system + **Signal Pin** mark (see Brand) |
| Platform | Next.js web beta → native iOS parallel track once validated |

## Brand — Waypoint / Signal Pin

- **Palette:** Ink `#1C2B36` (primary) · Blaze `#E1492F` (accent/signal) · Pool `#3E8E86` (secondary) · Contour `#C9BC9C` (neutral lines) · Paper `#F1ECDF` (background) · Night surfaces `#16242E`/`#1D2F3B`
- **Type:** Big Shoulders (display, condensed caps) · Public Sans (body) · IBM Plex Mono (data readouts)
- **Mark:** Signal Pin — map pin + dumbbell + signal arcs (inline SVG components; placeholder-grade until final icon pass)
- **Texture:** topo contours, coordinate readouts, waypoint numbers, mono data labels
- Full exploration history in `docs/brand/`.

## Architecture

```
Next.js (App Router, TS, Tailwind 4)        Supabase (Postgres 17 + PostGIS)
┌─────────────────────────────┐             ┌──────────────────────────────┐
│ Discovery list + filter rail│── reads ───▶│ cities / gyms / amenities /  │
│ Gym detail · Map (MapLibre) │             │ gym_amenities / gym_equipment│
│ NL search bar + voice (Web  │             │  (per-field provenance)      │
│ Speech) · Compare · Trips   │             ├──────────────────────────────┤
│ zustand+localStorage (saves)│── invokes ─▶│ edge fn: ai-search (Claude)  │
│ deterministic match scoring │◀─ fallback ─│  no key? → client parser     │
└─────────────────────────────┘             └──────────────────────────────┘
```

- **The FilterSet contract** is the spine: filter rail state, NL parser output, edge function output, and the scoring engine all speak the same `FilterSet` type.
- **Match scoring is deterministic** (weighted attribute coverage → % + reasons). The LLM never invents scores.
- **Provenance everywhere:** every amenity/equipment fact carries `source` (owner/scout_verified/user/scraped/seed/estimated) + `confidence`, surfaced in the UI as badges. This is the moat mechanics: the dataset is designed to self-improve.

---

## PHASE 1 — Tampa Web Beta *(this build, autonomous)*

| Step | Scope | Definition of Done |
|---|---|---|
| 0 | Foundation: scaffold, tokens, fonts, Signal Pin SVG, PLAN.md | `npm run build` clean; brand renders |
| 1A | Schema: cities/gyms/amenities/equipment + provenance, RLS, PostGIS | Migrations applied to live project; generated TS types in repo |
| 1B | Seed: ~30 web-verified real Tampa gyms, honest provenance | Live queries return real gyms; seed script re-runnable |
| 1C | Discovery: list + filter rail + gym detail | Search→filter→detail executed in browser |
| 1D | Map: MapLibre, waypoint pins, map↔list sync | Pins render/click through; verified visually |
| 1E | AI search + voice: edge fn + fallback parser + scoring w/ reasons | "racks + sauna near Hyde Park" → ranked reasoned results, with AND without LLM key; voice fills the bar |
| 1F | Shortlist + compare | Save→compare flow executed |
| 1G | Trips: manual trip → destination matching, tier honesty | Trip→matches flow executed |
| 1H | Ship: polish, a11y, reviewer agent, E2E pass w/ screenshots, push | All flows pass; repo on `main`; README complete |

### Out of scope for Phase 1 (deliberately)
Booking/payments, accounts/auth, reviews/UGC, gamification, partner/admin portals, push notifications, calendar OAuth (manual trips only), Android/iOS apps.

---

## User-locked additions (2026-06-10, mid-stint)
- **Google Places API: DROPPED entirely** (user call) — scrape pipeline + community fact-confirmations cover liveness. No GCP dependency.
- **Luxury segment**: Life Time-class clubs are `luxury`, not big_box (R6.5).
- **User profile/portal** (R8): visit log → membership-vs-pass recommendations; cloud sync; followed gyms + alert opt-ins; prefs that prefill filters.
- **P2 BOOKING NOTE — QR codes**: generate a check-in QR per booking/pass so users always have one even where gyms don't require it.
- **Machine-level equipment granularity** (hip thrust, abductor/adductor, leg curl/extension, calf) = **premium-gated** — data model + collection now (R7), UI badged "Pro preview — free during beta"; pricing gate at P2.
- **Blog + newsletter** (R9): editorial grounded in our data; email capture now, sender (Resend) when key provided; alerts: new gyms, changes at followed/visited gyms.
- **SEO/GEO** (R9): robots.txt, llms.txt, sitemap, JSON-LD ExerciseGym per gym page.
- **Vibe-aware search** (R6.5 + R7): vibe taxonomy on gyms (trendy/aesthetic/social/serene/old_school/no_frills/hardcore/beginner_friendly…), seeded 'estimated' from descriptions, refined by vision pass; `preferredVibes` SOFT FilterSet field (Kodawari rule: vibes boost, never exclude); parser handles "instagram/influencer friendly", "vibey", etc.; curated example-query chips in the search bar (analytics-driven later).
- **P2 PARTNER FUNNEL — owner self-serve form** (user-locked): email each gym a tokenized link (no account) → multi-choice + free-text + voice (same Web Speech pattern) → AI parses into structured facts at the `owner` provenance tier (rank 5, built for this); owner_submissions table + human-review queue before publish; doubles as the partner-acquisition funnel from the old spec.
- **Photo tagging**: gallery images stored with subject tags (R7) → galleries, alt text, future vision passes.
- **Equipment presentation (decided)**: data dense, display calm — category summary chips → grouped collapsibles w/ 'Show all N' → granularity powers filters/AI; brands as per-item metadata + one 'Brands on the floor' row; muscle-group cross-tags on machines; taxonomy standardized from top-25 brand catalog research (docs/research/equipment-taxonomy.md when agent lands).
- **Women's-only (user, trend)**: amenity keys womens_area + womens_only, parseable ('ladies only', "women's only gym"); data via next research pass; Amp'd Fitness Tampa flagged as candidate listing.

## PARTNER THESIS (north star, user-locked 2026-06-10)
**Scout helps gyms win their OWN members and keep the revenue** — the anti-ClassPass/Mindbody position (no fat take-rate). P2 partner portal: owner photo uploads + comment replies + equipment updates (all landing at 'owner' provenance tier → "Owner Listed" badge already built; full-form completion → **"Gym Verified" tag**), platform-visitor analytics + member outreach offers, **"Partner" badge** for portal gyms. Owner self-serve form (tokenized email link, voice+text, AI-parsed) is the on-ramp.

## PHASE 2 — Monetize *(post-beta validation; needs real-world counterparties)*

**Recommended model (2026-06-10, full reasoning + adversarial scrutiny in [docs/research/partner-outreach-plan.md](docs/research/partner-outreach-plan.md) §E): B2C floor + B2B ceiling, NEVER a take-rate.** Gated on a **measured consumer loop** (not a date) — which requires **analytics instrumented NOW** (repo has none; this is the binding pre-work).

- **Scout+ (primary floor):** thin consumer subscription — $4.99/mo or $39.99/yr, 7-day trial — gating travel/trip matching, machine-level equipment filters, unlimited saves + followed-gym alerts, visit-log savings analytics. Leakage-immune; covers data cost many times over. Stripe **Billing**. Auth arrives here (Supabase: Apple/Google/magic link); shortlists migrate from localStorage. Beta users grandfathered.
- **Partner SaaS (secondary ceiling):** single **flat** tier, $39/mo or $390/yr — analytics, lead/attribution dashboard, photo/comment management, Kodawari-bounded soft-boost placement, member-outreach. **No revenue share, ever.** Launches *after* Scout+, once there's an audience to sell (gyms see real visitor numbers before the ask). Free **Listed** tier + the owner-form funnel (Owner Listed / Gym Verified badges) is the on-ramp; the form's terminal screen is the monetization fork.
- **DROP the old "Stripe Connect (15% commission)" booking rail from P2** *(pending user confirmation — open decision #4)*: a take-rate IS the ClassPass/Mindbody mechanism the north star rejects, and the direct-purchase leakage problem makes it uncollectible without becoming the middleman we refuse to be. Capture the leak as **attribution data** reported free to the gym (the reason they pay the flat fee), not as a tax. Booking, if ever, becomes a P3 free convenience hand-off (gym keeps 100%) — never a P2 dependency, and it removes the heaviest build for the thinnest revenue.
- **Expansion-demand flywheel:** searches in uncovered cities increment demand counters; waitlist with social proof ranks the next metro.

## PHASE 3 — Scale & Engage

- **Gamification:** badges/streaks/points (merit-badge visual language reserved from brand work).
- **Reviews/UGC** with AI extraction that silently re-verifies amenity data (reviews double as data verification).
- **Membership-savings honesty nudge:** "3 visits cost $75; a membership is $50" — trust-building, deliberately anti-extractive.
- **Partner + admin portals** (only once partner volume justifies them).
- **More metros** by measured demand (Miami next per prior research).

## iOS — parallel track (not a phase)
Kicks off when the web beta validates. Native Swift/SwiftUI client on the SAME Supabase backend: native Speech framework for voice, EventKit for real calendar-based travel detection, MapKit. Nothing in Phase 1 is throwaway.

---

## Data strategy (the moat)

1. **Seed (now):** ~30 real Tampa gyms, web-verified existence, attributes marked `seed`/`estimated` with honest confidence.
2. **Metro expansion pipeline — free-first, escalate-only-on-residue** (full spec: [docs/research/metro-data-pipeline.md](docs/research/metro-data-pipeline.md)): per metro, build the facility list FREE from license-safe places data (Overture Maps + Foursquare OS Places + AllThePlaces — name/address/lat-lng/**website**/phone/socials, all storable & redistributable), then enrich by fetching each gym's own site (free tiers first: plain fetch → Jina Reader → only then paid Spider/Firecrawl) → cache pages → ONE Claude Haiku batch extraction pass with a strict facts schema → upsert at `scraped` 0.85. ~$20–35/metro all-in at ~1,000 facilities. Monthly Overture/FSQ release diffs (FSQ `date_closed`) are the free liveness sentinel that replaces dropped Google Places. NOTE: **Firecrawl is opt-in only, not the default** — it's just one (paid) tier of the fetch ladder.
3. **Outreach-first option (the cheap-data lever):** cold-email gym owners AHEAD of (or alongside) a metro's scrape so the owner self-serve form pre-fills/validates facts at the higher **`owner`** tier — every completion both upgrades data quality and saves that gym's extraction/validation cost. Realistic SMB response rates make this a supplement, not a replacement; full GTM + form + ingestion + monetization spec: [docs/research/partner-outreach-plan.md](docs/research/partner-outreach-plan.md).
4. **Verification ladder:** owner-confirmed > scout-verified > user-confirmed > scraped > seeded. UI always shows the tier. Phase 2's claim flow and Phase 3's reviews push facts up the ladder automatically.

## Environments & secrets

| Secret | Where it lives | Purpose |
|---|---|---|
| Supabase URL + publishable key | `.env.local` + Vercel/host env (public) | Client reads |
| `SUPABASE_SERVICE_ROLE_KEY` | `.env.local` ONLY (gitignored) | Seed script. **Rotate after beta** (was shared in chat). |
| `ANTHROPIC_API_KEY` | Supabase function secret (`supabase secrets set`) | Enables LLM intent parsing; app fully functional without it via fallback parser |

## Beta success signals (what "validated" means)
- Users complete search→detail→save loops without guidance
- NL/voice queries parse correctly ≥80% (log + review misses)
- Shortlist + compare used in ≥30% of sessions
- Any organic "when is [city] coming?" demand
