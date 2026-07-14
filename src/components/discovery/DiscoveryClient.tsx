"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { Compass, List, Map as MapIcon, SlidersHorizontal, Sparkles, Wrench, X } from "lucide-react";
import type { AmenityKey, City, EnrichedGym, EquipmentKey, FilterSet } from "@/lib/types/scout";
import { SEGMENT_LABELS, countActiveFilters, isEmptyFilterSet } from "@/lib/types/scout";
import { hasAmenity, passesHardFilters, scoreGyms } from "@/lib/scoring/scorer";
import { completeness } from "@/lib/completeness";
import { useFilterStore, type SortBy } from "@/stores/filterStore";
import { haversineMiles, pointInPolygon } from "@/lib/travel";
import { SearchBar } from "@/components/search/SearchBar";
import { FilterRail } from "@/components/filters/FilterRail";
import { SegmentIconRow } from "@/components/filters/SegmentIconRow";
import { GymCard } from "@/components/gym/GymCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { MapView } from "@/components/map/MapView";
import { AppliedFilterChips } from "./AppliedFilterChips";
import { BrowseRails } from "./BrowseRails";
import { CitySwitcher } from "./CitySwitcher";
import { DataTierBadge } from "@/components/ui/DataTierBadge";
import { useFocusTrap } from "@/lib/useFocusTrap";

export function DiscoveryClient({
  city,
  gyms,
}: {
  city: City;
  gyms: EnrichedGym[];
}) {
  const filters = useFilterStore((s) => s.filters);
  const parsedVia = useFilterStore((s) => s.parsedVia);
  const resetFilters = useFilterStore((s) => s.resetFilters);
  const setFilters = useFilterStore((s) => s.setFilters);
  const isParsing = useFilterStore((s) => s.isParsing);
  const [view, setView] = useState<"list" | "map">("list");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const mobileFiltersRef = useRef<HTMLDivElement>(null);
  const mobileFiltersCloseRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(mobileFiltersRef, mobileFilters);
  // Initial focus via effect, NEVER JSX autoFocus — must run AFTER the trap's
  // effect snapshots the opener (declaration order; see useFocusTrap's doc).
  useEffect(() => {
    if (mobileFilters) mobileFiltersCloseRef.current?.focus();
  }, [mobileFilters]);

  const travel = useFilterStore((s) => s.travel);
  const reachable = useMemo(() => {
    if (!travel) return gyms;
    return gyms.filter(
      (g) =>
        g.lat !== null &&
        g.lng !== null &&
        pointInPolygon({ lng: g.lng, lat: g.lat }, travel.polygon),
    );
  }, [gyms, travel]);
  const scored = useMemo(() => scoreGyms(reachable, filters), [reachable, filters]);
  const filtersActive = !isEmptyFilterSet(filters);

  const sortBy = useFilterStore((s) => s.sortBy);
  const setSortBy = useFilterStore((s) => s.setSortBy);

  // display-only re-sort of scoreGyms' output — NEVER feeds back into
  // scoring, the weak-match banner, or search_logs (those keep reading
  // `scored`, the match-ordered array).
  const displaySorted = useMemo(() => {
    if (sortBy === "match") return scored;
    if (sortBy === "price_asc") {
      return [...scored].sort((a, b) => {
        if (a.day_pass_price === null && b.day_pass_price === null) return 0;
        if (a.day_pass_price === null) return 1; // nulls last
        if (b.day_pass_price === null) return -1;
        return a.day_pass_price - b.day_pass_price;
      });
    }
    if (sortBy === "distance") {
      if (!travel) return scored; // guarded by a disabled control; degrade safely
      const origin = travel.origin;
      const distanceOf = (g: (typeof scored)[number]) =>
        g.lat !== null && g.lng !== null
          ? haversineMiles(origin, { lng: g.lng, lat: g.lat })
          : null;
      return [...scored].sort((a, b) => {
        const da = distanceOf(a);
        const db = distanceOf(b);
        if (da === null && db === null) return 0;
        if (da === null) return 1;
        if (db === null) return -1;
        return da - db;
      });
    }
    // "equipped": most equipment on file first; ties fall back to the SHARED
    // completeness score (lib/completeness.ts — never re-implemented here).
    return [...scored].sort((a, b) => {
      const d = b.equipment.length - a.equipment.length;
      if (d !== 0) return d;
      return completeness(b) - completeness(a);
    });
  }, [scored, sortBy, travel]);

  // Distance sort needs an active Near-Me origin — if travel clears while
  // it's selected, self-heal back to the default rather than leaving an
  // invalid mode selected (same degrade-politely spirit as NearMeFilter).
  useEffect(() => {
    if (sortBy === "distance" && !travel) setSortBy("match");
  }, [sortBy, travel, setSortBy]);

  const priceListedCount = useMemo(
    () => scored.filter((g) => g.day_pass_price !== null).length,
    [scored],
  );

  // Facet counts: how many gyms in the HARD-filtered pool (segments/
  // neighborhood/hours/price — the gates that actually exclude) have each
  // amenity/equipment. Amenity/equipment selections themselves rank, they
  // don't exclude, so counting against this pool (not the ranked `scored`)
  // is what keeps the copy honest — picking one won't shrink this number.
  const hardFilteredPool = useMemo(
    () => reachable.filter((g) => passesHardFilters(g, filters)),
    [reachable, filters],
  );
  const facetCounts = useMemo(() => {
    const amenities: Partial<Record<AmenityKey, number>> = {};
    const equipment: Partial<Record<EquipmentKey, number>> = {};
    for (const gym of hardFilteredPool) {
      if (hasAmenity(gym, "open_24h")) {
        amenities.open_24h = (amenities.open_24h ?? 0) + 1;
      }
      for (const rec of gym.amenities) {
        if (!rec.present) continue; // never-fabricate: count only stated facts
        amenities[rec.amenity_key] = (amenities[rec.amenity_key] ?? 0) + 1;
      }
      const seen = new Set<EquipmentKey>();
      for (const rec of gym.equipment) {
        if (seen.has(rec.equipment_key)) continue; // count gyms, not rows
        seen.add(rec.equipment_key);
        equipment[rec.equipment_key] = (equipment[rec.equipment_key] ?? 0) + 1;
      }
    }
    return { amenities, equipment };
  }, [hardFilteredPool]);

  const activeFilterCount = countActiveFilters(filters, travel !== null);

  // day-one telemetry: log each NL query once with its outcome (insert-only
  // table; what people ask for drives the roadmap). Best-effort.
  const lastLoggedQuery = useRef<string>("");
  useEffect(() => {
    const q = filters.rawQuery.trim();
    if (!q || !parsedVia || q === lastLoggedQuery.current) return;
    lastLoggedQuery.current = q;
    void getBrowserClient()
      .from("search_logs")
      .insert({
        query: q.slice(0, 300),
        parsed_via: parsedVia,
        result_count: scored.length,
        top_score: scored[0]?.matchScore ?? null,
      })
      .then(undefined, () => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.rawQuery, parsedVia]);
  const handleGymSelect = useCallback((id: string | null) => setHighlightedId(id), []);

  // Weak-match honesty: when nothing nails it, say so and offer one-tap fixes.
  const topScore = scored[0]?.matchScore ?? null;
  const relaxChips = useMemo(() => {
    const chips: { label: string; apply: () => void }[] = [];
    // read fresh state at click time — memoized closures must not race
    // when two chips are tapped before the next render
    const patch = (p: Partial<FilterSet>) =>
      setFilters({ ...useFilterStore.getState().filters, ...p });
    for (const seg of filters.segments) {
      chips.push({
        label: `Drop “${SEGMENT_LABELS[seg]}”`,
        apply: () => {
            const cur = useFilterStore.getState().filters;
            patch({ segments: cur.segments.filter((s) => s !== seg) });
          },
      });
    }
    if (filters.neighborhood) {
      chips.push({
        label: `Search all of ${city.name}`,
        apply: () => patch({ neighborhood: null }),
      });
    }
    if (filters.maxDayPass !== null) {
      chips.push({ label: "Any price", apply: () => patch({ maxDayPass: null }) });
    }
    if (filters.open24h) {
      chips.push({ label: "Any hours", apply: () => patch({ open24h: false }) });
    } else if (filters.openNow) {
      chips.push({ label: "Any hours", apply: () => patch({ openNow: false }) });
    }
    return chips;
  }, [filters, setFilters, city.name]);
  const showWeakBanner =
    filtersActive &&
    travel === null && // geo-narrowing explains scarcity; don't blame filters
    scored.length > 0 &&
    ((topScore !== null && topScore < 70) || (scored.length <= 3 && relaxChips.length > 0));

  // a11y: Escape closes the mobile filter sheet
  useEffect(() => {
    if (!mobileFilters) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileFilters(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileFilters]);

  // a11y: one polite live region for result-count + AI-parse state. Derived
  // directly from render state (no extra effect/debounce) — the search box
  // only commits to filterStore on submit (SearchBar's local `value` state
  // never touches it per keystroke), and every other filter control here
  // commits on discrete apply events (checkbox toggle, stepper click,
  // Near-Me activation…), so this can never fire on a per-keystroke basis.
  const liveMessage = isParsing
    ? "Searching…"
    : `${scored.length} ${scored.length === 1 ? "gym" : "gyms"} found${
        parsedVia === "ai" ? " — AI-parsed" : parsedVia === "fallback" ? " — quick-parsed" : ""
      }`;

  return (
    <main id="main-content" tabIndex={-1} className="flex flex-1 flex-col">
      <p aria-live="polite" className="sr-only">
        {liveMessage}
      </p>
      {/* hero — the search IS the product; center-composed so the band has
          presence at any width without dead flanks */}
      <section className="survey-grid-night bg-ink-deep">
        <div className="mx-auto max-w-7xl px-4 py-8 text-center sm:px-6 sm:py-12">
          <h1 className="display text-4xl text-paper sm:text-5xl">
            Find your <span className="text-blaze">fit.</span>
          </h1>
          <p className="mx-auto mt-2.5 max-w-xl text-sm leading-relaxed text-mist">
            The equipment, amenities, and hours that actually matter — type it
            or say it.
          </p>
          <div className="mx-auto mt-6 max-w-2xl text-left">
            <SearchBar citySlug={city.slug} />
          </div>
          <p className="readout mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1.5 text-pool/90">
            <span>
              {gyms.length} spots mapped · {city.name} · {Math.abs(city.lat).toFixed(4)}°{" "}
              {city.lat >= 0 ? "N" : "S"} · {Math.abs(city.lng).toFixed(4)}°{" "}
              {city.lng >= 0 ? "E" : "W"}
            </span>
            {/* basic-tier cities are honestly labeled at the browse level, not
                just per-gym — the plan's "honestly labeled" non-negotiable */}
            {city.tier === "basic" && <DataTierBadge tier="basic" />}
          </p>
        </div>
      </section>

      <SegmentIconRow />

      {/* value rails — empty-filter browse accelerators only; once a real
          filter applies, the rail's job is done and it steps aside */}
      {!filtersActive && <BrowseRails />}

      {/* controls row — sticky so count/query/view never scroll away */}
      <div className="sticky top-16 z-30 border-b border-paper-line bg-paper-raise/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <span className="font-mono text-xs uppercase tracking-wider text-ink">
            {scored.length} {scored.length === 1 ? "gym" : "gyms"}
            {/* honesty: most filters RANK rather than exclude (coverage
                scoring) — say so instead of letting "35 gyms" read as a bug */}
            {filtersActive && sortBy === "match" && (
              <span className="text-ink/55"> · ranked by match</span>
            )}
            {sortBy === "price_asc" && (
              <span className="text-ink/55">
                {" "}
                · {priceListedCount} of {scored.length} list a price
              </span>
            )}
          </span>
          {filtersActive && filters.rawQuery && (
            <span className="font-mono inline-flex items-center gap-2 rounded-full bg-ink px-3 py-1.5 text-[11px] text-paper">
              “{filters.rawQuery}”
              <button
                type="button"
                onClick={resetFilters}
                aria-label="Clear search"
                className="text-paper/70 hover:text-paper"
              >
                <X className="h-3.5 w-3.5" aria-hidden />
              </button>
            </span>
          )}
          {filtersActive && parsedVia === "ai" && (
            <span className="readout inline-flex items-center gap-1 rounded-full bg-pool-tint px-2.5 py-1 text-pool-deep">
              <Sparkles className="h-3 w-3" aria-hidden /> AI-parsed
            </span>
          )}
          {filtersActive && parsedVia === "fallback" && (
            <span
              className="readout inline-flex items-center gap-1 rounded-full border border-contour bg-paper px-2.5 py-1 text-ink/70"
              title="Parsed with Scout's built-in keyword engine"
            >
              <Wrench className="h-3 w-3" aria-hidden /> Quick-parsed
            </span>
          )}

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMobileFilters(true)}
              className="readout flex items-center gap-1.5 rounded-md border border-paper-line bg-paper-raise px-3 py-2 text-ink/80 hover:border-ink/40 lg:hidden"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Filters
              {activeFilterCount > 0 && (
                <span className="font-mono flex h-4 min-w-4 items-center justify-center rounded-full bg-blaze px-1 text-[10px] font-semibold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
            <CitySwitcher currentCity={city} />
            <label htmlFor="sort-select" className="sr-only">
              Sort results
            </label>
            <select
              id="sort-select"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="font-mono rounded-md border border-paper-line bg-paper-raise px-2 py-2 text-[11px] uppercase tracking-wide text-ink/80 hover:border-ink/40 focus:border-ink/40 focus:outline-none"
            >
              <option value="match">Best match</option>
              <option value="price_asc">Price: low to high</option>
              <option value="equipped">Best equipped</option>
              <option
                value="distance"
                disabled={!travel}
                title={!travel ? "Turn on Near Me to sort by distance" : undefined}
              >
                Distance: nearest{!travel ? " (needs Near Me)" : ""}
              </option>
            </select>
            <div
              className="flex overflow-hidden rounded-md border border-paper-line"
              role="group"
              aria-label="View mode"
            >
              <button
                type="button"
                onClick={() => setView("list")}
                aria-pressed={view === "list"}
                className={`readout flex items-center gap-1.5 px-3 py-2 transition-colors ${
                  view === "list" ? "bg-ink text-paper" : "bg-paper-raise text-ink/70 hover:text-ink"
                }`}
              >
                <List className="h-3.5 w-3.5" aria-hidden /> List
              </button>
              <button
                type="button"
                onClick={() => setView("map")}
                aria-pressed={view === "map"}
                className={`readout flex items-center gap-1.5 px-3 py-2 transition-colors ${
                  view === "map" ? "bg-ink text-paper" : "bg-paper-raise text-ink/70 hover:text-ink"
                }`}
              >
                <MapIcon className="h-3.5 w-3.5" aria-hidden /> Map
              </button>
            </div>
          </div>
        </div>
      </div>

      <AppliedFilterChips />

      {/* main */}
      <div className="survey-grid mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="flex gap-6">
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-20">
              <FilterRail
                city={city}
                resultCount={scored.length}
                amenityCounts={facetCounts.amenities}
                equipmentCounts={facetCounts.equipment}
              />
            </div>
          </aside>

          {/* Not a <main> — the page's <main> landmark now wraps this whole
              component (hero, search, filter rail included), not just the
              results column; only one <main> per page. */}
          <div className="min-w-0 flex-1">
            {showWeakBanner && view === "list" && (
              <div className="mb-4 rounded-xl border border-pool/30 bg-pool-tint/60 p-4">
                <p className="flex items-start gap-2.5 text-sm leading-relaxed text-ink">
                  <Compass className="mt-0.5 h-4 w-4 shrink-0 text-pool-deep" aria-hidden />
                  <span>
                    <b className="font-semibold">
                      {topScore !== null && topScore < 70
                        ? "Closest fits — nothing nails every must-have yet."
                        : `Only ${scored.length} ${scored.length === 1 ? "spot matches" : "spots match"} everything.`}
                    </b>{" "}
                    {relaxChips.length > 0 && "Loosen one to widen the field:"}
                  </span>
                </p>
                {relaxChips.length > 0 && (
                  <div className="mt-2.5 flex flex-wrap gap-2 pl-6.5">
                    {relaxChips.map((chip) => (
                      <button
                        key={chip.label}
                        type="button"
                        onClick={chip.apply}
                        className="rounded-full border border-pool/40 bg-paper-raise px-3 py-1.5 text-xs font-semibold text-pool-deep transition-colors hover:bg-pool hover:text-white"
                      >
                        {chip.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            {view === "list" ? (
              displaySorted.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {displaySorted.map((gym) => (
                    <GymCard
                      key={gym.id}
                      gym={gym}
                      onHover={setHighlightedId}
                      isHighlighted={highlightedId === gym.id}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No gyms match that"
                  description={`Try loosening a filter or two — or clear the search and browse all of ${city.name}.`}
                  action={{ label: "Clear filters", onClick: resetFilters }}
                />
              )
            ) : (
              <div className="h-[calc(100dvh-230px)] min-h-[520px] overflow-hidden rounded-xl border border-ink-line">
                <MapView
                  gyms={displaySorted}
                  selectedGymId={highlightedId}
                  onGymSelect={handleGymSelect}
                  center={[city.lng, city.lat]}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* mobile filter drawer */}
      {mobileFilters && (
        <div
          ref={mobileFiltersRef}
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filters"
        >
          <button
            type="button"
            aria-label="Close filters"
            onClick={() => setMobileFilters(false)}
            className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
          />
          <div className="absolute bottom-0 left-0 right-0 flex max-h-[85vh] flex-col rounded-t-2xl bg-paper shadow-2xl">
            <div className="flex items-center justify-between border-b border-paper-line px-4 py-3">
              <span className="display text-lg text-ink">Filters</span>
              <button
                type="button"
                ref={mobileFiltersCloseRef}
                onClick={() => setMobileFilters(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-paper-line text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <FilterRail
                city={city}
                resultCount={scored.length}
                collapsible
                amenityCounts={facetCounts.amenities}
                equipmentCounts={facetCounts.equipment}
              />
            </div>
            <div className="border-t border-paper-line bg-paper-raise p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
              <button
                type="button"
                onClick={() => setMobileFilters(false)}
                className="display w-full rounded-lg bg-blaze-deep px-4 py-3.5 text-sm tracking-wider text-white transition-colors hover:bg-blaze"
              >
                Show {scored.length} {scored.length === 1 ? "gym" : "gyms"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
