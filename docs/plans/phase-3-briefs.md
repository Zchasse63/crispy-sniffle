# Phase 3 — Worker Briefs (authored by Fable 5, 2026-07-14)

Wave 1 (parallel, disjoint): W-P3-city, W-P3-admin, W-P3-claim.
Wave 2 (after Wave-1 gate): W-P3-map-perf (MapView + DiscoveryClient split view + incremental render).
Fable-only gate steps: full-content ai-search edge redeploy + curl livetest (four-surface rule),
Miami is_live flip AFTER the switcher verifies locally, prod deploy + Miami browse verification.
Global worker rules: identical to phase-0-briefs.md.

## W-P3-city — city switcher, /city routes, per-city NL vocabulary (P14)
THE four-surface change. Everything lands in ONE coherent diff; Fable performs the edge
redeploy at the gate (deploy_edge_function requires full index.ts — never partial).
Files: src/app/page.tsx, src/app/city/[slug]/page.tsx (new), src/components/SiteHeader.tsx,
src/components/discovery/CitySwitcher.tsx (new), src/components/discovery/DiscoveryClient.tsx,
src/components/filters/FilterRail.tsx, src/lib/search/synonyms.ts, src/lib/search/nlParser.ts,
src/lib/search/aiSearch.ts, supabase/functions/ai-search/index.ts (code only — DO NOT deploy),
src/lib/queries/gyms.ts, src/app/me/page.tsx, src/app/sitemap.ts,
src/components/map/MapView.tsx (default-center fallback only), src/app/layout.tsx (metadata only).
DO NOT touch: SiteFooter (claim worker owns it), scout.ts (admin worker owns PROVENANCE_META;
City type already has is_live).

Grounded facts (verified):
- cities table: slug/name/state/lat/lng/tier/is_live. Tampa is_live=true; Miami false until
  Fable flips it at the gate. 8 placeholder metros must NEVER surface (filter is_live).
- fetchCityGyms(client, slug) at gyms.ts:242 is fully slug-parameterized and works for Miami
  TODAY. fetchCity does NOT Number()-coerce lat/lng (PostgREST wire strings — mapbox coerces
  by luck); FIX that while there.
- Tampa hardcodes to de-hardcode: app/page.tsx:10 fetchCityGyms(client,"tampa");
  me/page.tsx:17 (visit-log/saves lookup must union LIVE cities so Miami saves stop
  vanishing — use fetchGymsByIds for followed/visited gyms instead of a Tampa-only list);
  DiscoveryClient.tsx ~85/132/269 (hero copy, "N spots mapped · Tampa quadrant · coords",
  "Search all of Tampa" relax chip → use city.name); FilterRail.tsx:368 "All of Tampa";
  gym/[slug]/page.tsx copy fallbacks are OUT of scope (leave); layout.tsx metadata mentions
  Tampa (genericize app-level description); MapView.tsx:23 Tampa default center (fallback
  only — DiscoveryClient already passes center=[city.lng, city.lat]).
- NEIGHBORHOOD vocabulary is the four-surface piece. Today: NEIGHBORHOOD_SYNONYMS in
  synonyms.ts:264 is a flat Tampa map consumed by (1) FilterRail options, (2) nlParser.ts
  ~123-128 fallback parse, (3) aiSearch.ts:23 client-side validation, (4) the edge fn
  prompt which EMBEDS Tampa neighborhoods + mapping hints (ai-search/index.ts:68-87).
  Restructure to Record<citySlug, Record<name, aliases>> with a getNeighborhoods(citySlug)
  helper; thread citySlug: SearchBar/DiscoveryClient → aiSearch request body → edge fn
  (per-city vocab in the prompt; validate against that city's set server-side) → nlParser
  fallback. FilterSet SHAPE unchanged (neighborhood stays string|null) — but all four
  surfaces + synonyms.ts change together per non-negotiable #4.
- Miami "neighborhoods" in DB are municipalities and 17/40 rows are literally "Miami" —
  do NOT build a Miami neighborhood vocab. Rule: cities.tier === "basic" → hide the
  Neighborhood section in FilterRail entirely and give the edge fn/nlParser an empty set
  (parser must not emit neighborhood for basic cities; scorer hard-excludes on mismatch).
- Routing model: "/" stays the flagship discovery page, now city-aware: resolve city as
  (a) ?city= param if present and is_live, else (b) geo-IP nearest LIVE city via Netlify's
  x-nf-geo request header (read with next/headers in the RSC — proxy.ts middleware emits
  NO prod bundle, do not use middleware), else (c) cookie "scout-city" if set and live,
  else (d) tampa. Write the cookie via the switcher (client sets document.cookie +
  router.push("/?city=slug")). /city/[slug] (new) renders the same discovery surface for
  SEO with generateMetadata per city + canonical; unknown/not-live slugs → notFound().
- CitySwitcher in SiteHeader: compact select/dropdown next to the logo badge, options =
  fetchCities filtered is_live, current city passed down from the page via a prop-drilled
  or context value — keep it simple: DiscoveryClient already receives city; the header is
  in the root layout (no city context) — so put the switcher INSIDE the discovery surface
  controls row instead (results bar, next to sort) AND replace the header's hardcoded
  "Tampa Beta" badge with the neutral "Beta" (header stays city-agnostic). Note this
  decision in your report.
- x-nf-geo: JSON header {city, subdivision, country, latitude, longitude} — absent in
  local dev (fallback chain covers it). Nearest-live-city by haversine (lib/travel.ts
  already exports haversineMiles — reuse).
- sitemap.ts: add / and /city/[slug] for live cities.
- e2e: tests asserting Tampa copy may break — update ONLY test files whose assertions
  reference copy you changed; report which.

## W-P3-admin — operator dashboard, provenance guard, table pagination
Files: src/app/admin/(app)/page.tsx, src/components/admin/AdminNav.tsx,
src/components/admin/InspectorEditor.tsx, src/components/admin/GymTable.tsx,
src/lib/types/scout.ts (PROVENANCE_META ranks ONLY), src/lib/admin/* (read; edit only
where the dashboard/nav counts need a query helper).
Problems (audit-confirmed):
1. Dashboard leads with vanity tiles + two dead "—" tiles; pending moderation / owner
   submissions / data-quality alerts never surface. Rebuild: "Needs attention" row first
   (pending owner submissions count, flagged reviews count, fact-correction count if
   cheaply queryable, data-quality alerts), then catalog stats below. Remove dead tiles.
2. AdminNav has no badge counts — add count pills for owner-queue and moderation queues
   (server component? read how AdminNav gets data; a lightweight parallel count query in
   the layout is acceptable).
3. PROVENANCE_META (scout.ts ~617) ranks scout_verified ABOVE owner — the spec (CLAUDE.md
   provenance ladder) says owner > scout_verified. Fix the ranks; then verify no logic
   depended on the wrong order (grep usages; report each).
4. InspectorEditor silently overwrites owner-tier facts as scout_verified. Add a guard:
   when a field's current source is 'owner', require an explicit confirmation step
   (inline "This fact is owner-confirmed — overwrite?" toggle per field, not a browser
   confirm()) before the save payload may include it; visually badge owner-tier fields.
5. GymTable renders the full catalog — add client-side pagination (50/page) with the
   existing filter box operating across ALL pages (filter first, then paginate).

## W-P3-claim — public "claim your gym" door + footer
Files: src/app/for-gyms/page.tsx (new), src/components/SiteFooter.tsx,
src/components/community/CommunitySection.tsx.
Problem: /own is invite-token-only and robots-disallowed; a gym owner who hears about
Scout has NO path in — the "Verify your info" CTA is a mailto.
Build:
1. /for-gyms: on-brand marketing/instruction page — what owners get (owner-confirmed facts
   get top billing + the Owner Listed / Gym Verified badges), how it works (3 steps:
   request your link via email → confirm your facts (~5 min, save-and-resume) → staff
   review, live within 2 business days), request CTA = mailtoHref("Owner link request: " +
   "[gym name]") with guidance to include gym name + role, plus a note that the form works
   great on phones. Honest tone, no hype. generateMetadata. Link back to Explore.
2. SiteFooter: add "For gym owners" link (SCOUT column); ALSO genericize the hardcoded
   "TAMPA QUADRANT · 27.9506° N · 82.4572° W" line to non-city-specific brand copy
   (e.g. "FIND YOUR FIT." exists; make the coords line simply drop or say "Tampa Bay ·
   Miami" — pick with taste) — the city worker is de-hardcoding everything else and does
   NOT own the footer.
3. CommunitySection owner CTA: "Verify your info" links to /for-gyms instead of raw
   mailto (keep the sentence copy).

## W-P3-map-perf (Wave 2, after Wave-1 gate) — map upgrade + incremental rendering (P9 + front-door perf)
Files: src/components/map/MapView.tsx, src/components/discovery/DiscoveryClient.tsx.
Grounded problems: MapView creates ONE DOM mapboxgl.Marker per gym (747 raw nodes, no
clustering — metro-scale ceiling); price pins exist but render for every priced gym
regardless of rank; card-hover → pin-highlight sync is wired but unusable without a split
view; the list renders all 747 cards in one pass (no pagination/virtualization; earlier
live measurement: ~4s render jank on scroll).
Build:
1. CLUSTERING: switch to a mapbox GL source+cluster layer approach (cluster: true on a
   geojson source, cluster circles + count labels, click-to-zoom) — the price-pin DOM
   markers remain ONLY for the top ~40 ranked gyms in the current result set; everything
   else lives in the clustered layer. No new deps — mapbox-gl's native clustering.
2. RANK-LIMITED PRICE PINS: pins show for the first N=40 of the CURRENT display-sorted
   results (the prop DiscoveryClient already passes); keep segment colors + price labels;
   preserve keyboard operability (role=button, aria-label, Enter/Space — existing rigor).
3. DESKTOP SPLIT VIEW: at lg+, LIST and MAP become a split layout (results left ~60%, map
   right ~40%, map sticky within viewport height) with the existing hover sync finally
   active both ways (card hover highlights pin; pin hover/click scrolls+highlights card).
   Mobile keeps the LIST/MAP toggle exactly as-is.
4. INCREMENTAL RENDER: list renders 24 cards initially + IntersectionObserver sentinel
   loading +24 per crossing ("Showing X of Y" readout for honesty); map always receives
   the FULL result set (clustering handles scale); weak-match banner + search_logs remain
   on the full scored array (never the truncated slice).
5. Respect prefers-reduced-motion for scroll/zoom animations (flyTo → jumpTo under
   reduce).

## Phase-3 gate (Fable)
tsc/build/vitest; FULL-CONTENT ai-search edge redeploy + curl livetest with a Tampa
neighborhood query AND a Miami query (expect no neighborhood emitted); local walkthrough:
switcher, /city/miami (after local is_live override…verify via ?city=miami), geo fallback
chain, me-page Miami saves, admin dashboard/guard, /for-gyms; flip Miami is_live in prod;
push; verify Miami browse + switcher live in prod.
