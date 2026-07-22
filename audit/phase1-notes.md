# Phase 1 — SCALE PACK (implementation notes)

Handoff for reviewer. No commit / push / deploy / migration apply was performed.

## What changed (per brief item)

### 1. Pagination kit
- **New** `src/lib/supabase/paginate.ts` — `paginateAll<T>(makeQuery)` pages of 1000 until short page.
- **New** `scripts/lib/paginate.mjs` — same pattern for Node loaders.
- **Applied to:**
  - `src/app/sitemap.ts` — gyms select, status filter kept, order by `slug`.
  - `src/lib/queries/gyms.ts` `fetchCityGyms` — via shared helper; order still `rating desc nullsFirst:false`, then `id`.
  - `src/lib/admin/gyms-admin.ts` `listGymsForAdmin` — paginated; order `name`, then `id` (stable pages).
  - `scripts/land.mjs` — full cross-city dedup set paginated (still all cities).
  - `scripts/geocode.mjs`, `parking-enrich.mjs`, `decision-enrich.mjs` — unbounded gyms lists.
  - Also paged (same bug class, genuine unbounded reads): `vision-enrich.mjs`, `rehost-photos.mjs`.
- **Left alone:** `extract.mjs` (slug-bounded `.in()`), per-slug `.maybeSingle()` loaders, `seed.mjs` upserts.

### 2. Admin data-quality via SQL aggregates
- **New migration file** `supabase/migrations/20260722000001_data_quality_stats.sql`
  - `public.data_quality_stats()` → `jsonb`, `security definer`, staff or `service_role` only.
  - Reproduces: totalGyms, provenanceMix (amenities∪equipment), lowConfidenceFacts (&lt;0.7), priceGapGyms (no monthly/day_pass/membership_plans), staleGyms (null or &gt;90d `last_fetched_at`), statusMix, cityBoard (counts + avg completeness matching `lib/completeness.ts` CORE_FIELDS ×10, priceGaps).
- `getDataQuality` now calls `.rpc("data_quality_stats")`; **TS `DataQuality` shape unchanged**.
- `database.ts` Functions entry added for the RPC.
- **Reviewer must apply migration** before admin data-quality page works against live DB.

### 3. Gym detail "similar spots" + price bands
- Replaced `fetchCityGyms` on detail with:
  - `fetchSimilarGyms` — same `city_id` + `segment`, status not closed/moved/duplicate, `neq id`, limit 5, full join on those rows only.
  - `fetchCityPriceFields` — paginated slim `(id, segment, day_pass_price)` for `computePriceBands`.
- UI still shows up to 5 similar cards (was slice 0..4 of full city; now limit 5).

### 4. City page double-fetch
- `generateMetadata` uses `fetchCity` only (city row).
- Body uses `fetchCityGymCardsCached` (`React.cache` on slug; client created inside so cache keys correctly).
- Homepage `/` uses `fetchCityGymCards` (no need for metadata cache there).

### 5. Payload diet (`fetchCityGymCards`)
- Slim gym column select (no membership jsonb blobs, pricing_notes, instagram, fee fields, etc.).
- Joins: amenities (key/present/source/confidence), equipment (+ brand/qty/max_weight for scorer + GymCard hooks), **slim parking** (access/fee_detail/is_primary for GymCard “free parking” + map pin headline). **No transit query.**
- Still returns `EnrichedGym` with null/empty for dropped fields — **no component changes**.
- **Kept deliberately (would change scoring/order if dropped):**
  - `description`, `phone`, `website` — `completeness()` drives unfiltered browse sort.
  - `members_guest_note`, `drop_in_note` — `deriveAccessStatus` title/note on cards.
  - Parking rows (slim) — GymCard free-parking label + MapView pin.
- Dev-only log: `[fetchCityGymCards] {slug}: N gyms, B bytes` when `NODE_ENV===development`.
- Detail / trips / compare / shortlist still use full `fetchCityGyms` / by-ids paths.

### 6. `chunkedIn` hardening
- Warns via `console.warn` when any chunk response length === 1000; still returns (no throw).
- `fetchGymsByIds` and `fetchGymsBySlugs` now route through `chunkedIn`.

## Verification

```
npx tsc --noEmit   → exit 0 (after removing phantom node_modules/@types/* 2 dirs)
npx vitest run     → 15 files, 350 tests passed
```

No existing tests required updates. No e2e / live browser (no `.env.local` by design).

## Deliberately not done
- Did not commit, push, deploy, or apply migrations.
- Did not touch `.env*`.
- Did not change scorer weights, honesty chips, or FilterSet surfaces (Phase 2).
- Did not null out `description` on browse (would alter completeness-based ranking — honesty/scoring invariant).
- Did not drop parking from browse DTO (GymCard + map pin use it; slim projection only).
- `extract.mjs` left as slug-list `.in()` (not unbounded).
- City-page metadata no longer shares gym fetch with body (better: metadata never needed gyms). Cache still wraps the body browse fetch for any future dual callers of `fetchCityGymCardsCached`.

## Reviewer checklist
1. Apply `20260722000001_data_quality_stats.sql` via Supabase MCP / SQL.
2. Spot-check admin Data Quality numbers vs pre-fix (should fix amenity undercount).
3. Measure city page RSC payload (dev log or Netlify) — target &lt;500 KB.
4. Curl sitemap after Miami-scale data — gym URL count should exceed 1000 when live gyms do.
5. Gym detail “similar spots” + DropInCard price context still render without full-city load.
