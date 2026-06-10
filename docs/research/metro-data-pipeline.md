# Metro Expansion Data Pipeline — Free-First, Escalate-Only-On-Residue

**Status:** Proposed (researched 2026-06-10, three-agent web research with source URLs; numbers verified where noted)
**Principle:** Each stage runs the *cheapest* source first and passes only its failures (the "residue") to the next, more expensive stage. Paid tools never touch a record a free tool already handled. Every fact lands in the existing provenance ladder (`scraped` 0.85 > `estimated` 0.65/0.55) — same contract as `scripts/enrich.mjs`.

**Per-metro budget at ~1,000 facilities:** $0 discovery → ~$10–15 extraction → ~$5–10 targeted escalation → **~$20–35 typical, $60 worst case.** (Tampa R3 equivalent was done with hand-driven agents; this industrializes it.)

---

## Stage 0 — Metro sizing & selection ($0)

Before committing to a metro, size it with the same free data used for discovery:

- DuckDB count query against the latest **Overture Maps Places** monthly release (S3 GeoParquet, no API key) for the metro bbox across fitness categories. ~2 minutes per metro.
- Verified Tampa baseline (release 2026-05-20.0, bbox −82.85→−82.20, 27.60→28.20): **2,209 fitness POIs** (gym 1,212, martial_arts_club 390, yoga_studio 205, pilates_studio 117, gymnastics 49, boxing/kickboxing 52, climbing 3, + instruction/trainer categories), **90.8% with website URLs**, avg confidence 0.83.
- This replaces the dropped Google Places Aggregate idea for market sizing.

## Stage 1 — Discovery: build the master facility list ($0)

Three free, license-safe sources, merged in this order:

1. **Overture Maps Places** (primary; CDLA-Permissive-2.0 / Apache-2.0 — storing, modifying, monetizing all permitted; attribution text in repo + /about).
   - Pull: name, structured address, lat/lng, `websites[]`, `socials[]`, `phones[]`, `categories.primary+alternate`, `confidence`, per-attribute `sources`.
   - The `websites[]` field is the **enrichment key** — present on ~91% of Tampa fitness rows.
2. **Foursquare OS Places** (secondary; Apache 2.0; free via Hugging Face after registration).
   - Fuzzy-match to Overture rows (name similarity + ≤100m radius; Placekey optional as join key).
   - Adds: `date_closed` (the only free explicit closed flag — our liveness sentinel, relevant to cases like 9Round), long-tail recall, website/phone gap-fill.
3. **AllThePlaces** (CC0, weekly dumps) — authoritative chain locations straight from store locators (Planet Fitness, Crunch, OTF, F45, Anytime, etc.). Overrides both sources for chains.

Then: drop `confidence < 0.5`, flag 0.5–0.75 for extra validation, dedupe, load to a Postgres staging table (`facility_candidates`) with per-source provenance.

**Ruled out (legal):** Yelp Fusion (24h cache max), Foursquare paid API (no caching on PAYG), Outscraper/SerpAPI Google-derived datasets (same ToS taint that made us drop Places; Google sued SerpApi late 2025), OSM as a base layer (ODbL share-alike + 7–14x sparser than Overture for Tampa fitness). OSM/Overpass stays **supplemental-display only** (parking polygons, as already shipped in R4 with ODbL attribution).

## Stage 2 — Free validation & normalization ($0)

Plain Node, no vendors:

- **Website liveness:** HEAD/GET every website URL (our own fetcher, modest concurrency, per-domain politeness). Dead domain → try `web.archive.org` (free) → if archive-only, flag `archive_recovered` (Westshore CF / Dale Mabry CF precedent); if nothing, route to Stage 5 website lookup.
- **Geocode sanity:** existing `scripts/geocode.mjs` pattern (Census + Nominatim consensus, 3km plausibility cap) — but only for rows with Overture confidence < 0.85 or geocoder disagreement, since high-confidence Overture coords are positionally reliable.
- **Rule-based segment pre-classification** from category + name tokens (crossfit/yoga/pilates/boxing/climb...). AI refines later; Kodawari rule still applies (segments are vibes, equipment is ground truth).
- **Socials capture** (Instagram/Facebook from Overture/FSQ) — banked for the R7-style vibes/vision pass.

## Stage 3 — Bulk page fetch (free → ~$5, cached forever)

Target: ~5 pages/site (homepage + pricing/memberships + amenities + schedule + about/contact).

- **Page selection:** fetch `sitemap.xml` first (free); else extract nav links from homepage and match against a path dictionary (`/pricing`, `/memberships`, `/amenities`, `/schedule`, `/about`, `/contact`, `/day-pass`).
- **Tier A — plain HTTP fetch ($0):** our own Node fetcher + readability/turndown to markdown. Most WordPress/Squarespace gym sites work.
- **Tier B — Jina Reader ($0):** `https://r.jina.ai/<url>` with free API key = 500 RPM, clean markdown, handles most JS rendering. The default workhorse; near-zero code.
- **Tier C — Spider.cloud (~$5/metro) or Firecrawl ($16/mo Hobby = 5k pages):** only for domains where A and B both fail. Firecrawl is the convenient managed option if we want one (opt-in; CLI already installed).
- **Cache everything** (markdown + raw HTML) in Supabase Storage keyed `facility_id/page-slug`, with fetch timestamp + tier used. **Re-extraction must never require a re-crawl** — schema changes cost only the Stage 4 LLM pass.

## Stage 4 — Structured extraction (~$10/metro, the core spend)

One **Claude Haiku 4.5 Messages Batch API** request per facility (batch = 50% off list):

- Input: all cached pages for the gym concatenated (~15k tokens), shared system prompt (instructions + facts schema) marked for prompt caching.
- Output: strict JSON schema — amenities, equipment (incl. machine granularity), parking (gym-stated text), day-pass/membership prices, hours, phone, description, vibe descriptors, photo URLs (from `<img>`/og:image — no vision tokens here).
- Land via the existing `enrich.mjs` ladder: `source='scraped'`, confidence 0.85; estimates only gap-fill (0.65/0.55). Known JS guards apply (explicit null checks; PostgREST numeric-as-string coercion).
- **Quality fallback:** re-run low-confidence/contradictory gyms through Sonnet batch (~3x cost, still ~$30/metro if *everything* needed it — it won't).
- Math: 1,000 gyms × ~15k in / ~1k out on Haiku batch ≈ **$10**.

## Stage 5 — Targeted paid escalation (~$5–10/metro, residue only)

- **Missing/dead websites (~10–15% of rows):** Exa search ($7/1k queries → ~$1–2/metro) to find official sites; socials-only gyms get their Instagram noted instead.
- **Hard sites (~5–10%):** Mindbody iframes, schedule widgets, JS-walled pricing → **Browserbase + Stagehand** (TypeScript, our own Anthropic key, $20/mo = 100 browser-hours, far more than needed). Scripted `act()/extract()` flows for the three common patterns (Mindbody, Zen Planner, Wodify).
- **Optional pilot:** Rtrvr.ai free tier (250 credits ≈ 50 sites) as a comparison harness — capable shape (URL array + JSON schema in, validated rows out, ~$0.12/task) but a 2024-founded ~2-person unfunded vendor with unpublished rate limits; never load-bearing.

## Stage 6 — Vision/vibes pass (optional, ~$2–5/metro)

Existing `scripts/vision-enrich.mjs` pattern: own-site gallery photos (collected in Stage 4) → Haiku vision, 1–3 images/gym, gap-fill only at `estimated` 0.65 ("Seen in facility photos"), vibe tags for the soft `preferredVibes` scorer. Skip archive.org and bracket-escaped URLs (known Anthropic image-fetch rejects).

## Stage 7 — Parking intelligence (mostly $0)

Same R4 four-source ladder, now fed automatically: gym-stated parking text falls out of the Stage 4 schema ($0 marginal); strip-plaza inference (0.55) and OSM/Overpass polygon edge-distance (free, ODbL-attributed, polygon vertices not centroids) run as the existing `parking-enrich.mjs` pass.

## Stage 8 — Freshness loop ($0–small)

- **Monthly:** diff new Overture + FSQ OS releases against our DB → new facilities (run Stages 2–4 on them only) and `date_closed` hits (flag for verification). This is the free replacement for the Google liveness sentinel.
- **Continuous:** community confirmations/reviews silently re-verify facts (already shipped in R8).
- **Quarterly:** re-fetch only pricing/schedule pages (cache-diff; unchanged page = no LLM call), since prices are the most perishable high-value fact.

---

## Cost ladder summary (per ~1,000-facility metro)

| # | Stage | Tooling | Cost |
|---|-------|---------|------|
| 0 | Sizing | Overture DuckDB count | $0 |
| 1 | Discovery | Overture + FSQ OS + AllThePlaces | $0 |
| 2 | Validation | Own fetcher, archive.org, Census/Nominatim | $0 |
| 3 | Bulk fetch (~5k pages) | Plain fetch → Jina free → Spider/Firecrawl | $0–16 |
| 4 | Extraction | Claude Haiku 4.5 Batch, strict schema | ~$10 |
| 5 | Escalation | Exa (~$2) + Browserbase/Stagehand (~$5) | ~$5–10 |
| 6 | Vision/vibes | Haiku vision, gap-fill | ~$2–5 |
| 7 | Parking | Stage-4 byproduct + OSM | ~$0 |
| 8 | Freshness | Monthly dataset diffs | ~$0 |
| | **Total** | | **~$20–35 typical** |

## Build order (when implementing)

1. `scripts/discover.mjs` — Overture+FSQ+ATP pull/merge/dedupe → staging table (architect first; touches schema: `facility_candidates`, source provenance columns).
2. `scripts/fetch-pages.mjs` — tiered fetcher + Supabase Storage cache.
3. `scripts/extract-batch.mjs` — Haiku batch submit/poll/land via enrich ladder.
4. Escalation scripts (Exa lookup, Stagehand flows) — only after measuring Stage 3/4 residue on a real metro.
5. Freshness cron (monthly diff) — last.

**Acceptance test (build rule #1):** run the full pipeline on a *holdout slice of Tampa we already hand-enriched* and diff against the R3/R4 ground truth — that measures extraction precision/recall for free before pointing it at a new metro.
