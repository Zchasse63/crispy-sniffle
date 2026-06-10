# Google Places API (New) — Decision Report for Scout

*Researched 2026-06-10 against live Google docs (post-March-2025 per-SKU pricing model confirmed current). Full agent research; verdicts adopted into PLAN. Re-check the pricing page before committing budget forecasts — Google revises this model frequently.*

## TL;DR verdict

| Candidate use | Allowed? | Cost | Verdict |
|---|---|---|---|
| **Liveness validation** (store place IDs → poll `businessStatus`/`movedPlaceId` as an ephemeral trigger for our own re-verification) | ✅ Place IDs storable forever | **$0/mo at beta scale** (≤5k free Pro calls), ~$85/mo at 10 cities | **★ Adopt — best near-term integration** |
| City-expansion discovery → harvest into our DB | ❌ Storing names/addresses/websites = banned scraping (ToS §3.2.3(a)(iii)); augmenting a directory product is the named example in §3.2.3(d)(iii) | ~$40–60/metro (irrelevant) | **Never store.** Ceiling: transient operator-review queue keyed by stored place IDs; our DB records only what we verify from primary sources. Prefer OSM/municipal/manual seeds. |
| Photos source (+ vision extraction) | ❌ No photo storage; photo refs can't be cached; **vision-extracted facts from Google photos = banned "creating content" (§3.2.3(c))**, with AI/ML use named in (c)(vii) | $7/1k per render, forever | **Avoid.** Photos must come from gym sites (fine), direct permission, or our own shoots. |
| Live sidecar display (open-now, ratings — shown, never stored) | ⚠️ Yes, but **not on/near a non-Google map** (§3.2.3(e)) — we render MapLibre. Escape hatch: Places UI Kit (SST §15 exemption) | $20/1k views (Enterprise fields); scale-hostile uncached | Maybe later, map-free surfaces or UI Kit only |
| AI summaries / Insights / Aggregate | ✅ displayable w/ "Summarized with Gemini" disclosure; not storable. Places Aggregate allows 30-day cached POI counts → derived "Customer Values" | Summaries $25/1k; Aggregate for analytics | Skip summaries (own editorial is the moat). **Places Aggregate = legit market-sizing tool for picking the next metro.** |

## Key facts

**Endpoints:** Text Search (≤60 results/query via 3 pages; `includedType`, `openNow`, `minRating`, new `includeFutureOpeningBusinesses`) · Nearby Search (≤20, no pagination) · Place Details (FieldMask mandatory) · Photos (≤10 refs/place, refs expire, attribution mandatory) · Autocomplete (session tokens).

**Field-tier gotchas:** `websiteUri`, phone, **hours**, `rating` are **Enterprise ($20/1k)** — not Pro. `businessStatus` is Pro ($17/1k). `parkingOptions`/`accessibilityOptions`/`reviews`/AI summaries are Enterprise+Atmosphere ($25/1k). One stray field in a FieldMask jumps the whole request's tier — build per-use-case mask constants.

**Free tier (replaced the $200 credit, March 2025):** per-SKU monthly free calls — Essentials 10k / Pro 5k / Enterprise 1k. IDs-only Text Search and IDs-only Details are unlimited free.

**Fitness place types:** `gym`, `fitness_center`, `yoga_studio`, `wellness_center`, `sauna`, `sports_club`, etc. — but **no types for pilates, martial arts, boxing, climbing, CrossFit, or barre** even after the Feb 2026 expansion. Google can't see the niches; our taxonomy can. That's moat-affirming.

**Storage rules (the load-bearing part):**
- Place IDs: storable **indefinitely** (SST §3) — the only durable handle.
- Lat/lng: cacheable **30 days max** (SST §14.3). Nothing else has any cache allowance.
- §3.2.3(a): no pre-fetching/indexing/storing content; "copy and save business names, addresses, or user reviews" is the named example.
- §3.2.3(c): no creating content from Maps content; (c)(vii) explicitly bans AI/ML training/eval use.
- §3.2.3(d)(iii): no use "in a listings or directory service" to create/augment — Scout's category, named.
- §3.2.3(e): Places content may not be displayed on/near a **non-Google map** (we use MapLibre). Places UI Kit (SST §15) is the explicit exemption if ever needed.
- Attribution: Google Maps logo/text required wherever Places data shows, even mapless; AI summaries need verbatim "Summarized with Gemini" + report links.

**Scenario costs (verified):**
- One-time metro discovery sweep (~1,000 fitness places, Enterprise fields via Text Search + 5 photos): **~$40–60 list**. (But see storage ban — only IDs are keepable.)
- Monthly liveness re-check of 1,000 stored places (`id,businessStatus` Pro mask): **$0** under free cap; 10k places ≈ **$85/mo**.

**Recent additions worth knowing:** `movedPlace`/`movedPlaceId` (Oct 2025, relocation tracking — pairs with liveness); `includeFutureOpeningBusinesses` + `openingDate` (Mar 2026 — discover gyms before they open); Places Insights BigQuery + Places Aggregate API (market analytics); Grounding with Google Maps in the Gemini API ($25/1k, placeId storable).

## Adopted plan for Scout

1. **Phase 2 integration: liveness sentinel.** Add `google_place_id` column (legal to store). One-time ID matching pass for our gyms (IDs-only Text Search = free). Monthly cron: Details with `id,businessStatus,movedPlaceId` mask → status change queues OUR re-verification (and we record our own finding, never Google's value). $0/month at beta scale. This automates what round-1 research did by hand (8 closed gyms pruned).
2. **City expansion:** keep the agent-scrape pipeline as the data source; optionally use IDs-only Text Search to *size* a metro and build a transient operator checklist. Places Aggregate for density analytics when choosing the next city.
3. **Hard no's recorded:** no harvesting Places content into the DB; no Google photos storage or vision-extraction; no Places data near the MapLibre surface.

## Prerequisites when we integrate
GCP project + billing card (required even within free caps) → enable **"Places API (New)"** (legacy is a different, closed service) → server-side restricted API key → FieldMask constants per use case → per-SKU usage monitoring.
