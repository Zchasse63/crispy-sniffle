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

## PHASE 2 — Monetize *(post-beta validation; needs real-world counterparties)*

Gated on: beta users searching + saving + travel-matching in Tampa, and ≥a handful of gyms willing to take day-pass bookings.

- **Booking + payments:** Stripe Connect (15% commission), day-pass checkout, QR pass validation — **webhook-confirmed writes only** (prior failure: client-fabricated QRs).
- **Premium subscription:** travel features move behind Stripe Billing (beta users grandfathered).
- **Partner self-service:** claim-your-gym flow; **verification-form-as-funnel** (scraped gyms get a free "Verified" badge form whose last question is "want to sell day passes?").
- **Expansion-demand flywheel:** searches in uncovered cities increment demand counters; waitlist with social proof ranks the next metro.
- **Auth arrives here** (Supabase Auth: Apple/Google/magic link) — shortlists migrate from localStorage.

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
2. **Enrichment pipeline (script included, run later):** Firecrawl scrape of gym sites → LLM extraction → per-field upsert with `scraped` provenance.
3. **Verification ladder:** owner-confirmed > scout-verified > user-confirmed > scraped > seeded. UI always shows the tier. Phase 2's claim flow and Phase 3's reviews push facts up the ladder automatically.

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
