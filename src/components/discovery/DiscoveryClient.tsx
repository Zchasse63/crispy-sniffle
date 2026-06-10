"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Compass, List, Map as MapIcon, SlidersHorizontal, Sparkles, Wrench, X } from "lucide-react";
import type { City, EnrichedGym, FilterSet } from "@/lib/types/scout";
import { SEGMENT_LABELS, isEmptyFilterSet } from "@/lib/types/scout";
import { scoreGyms } from "@/lib/scoring/scorer";
import { useFilterStore } from "@/stores/filterStore";
import { SearchBar } from "@/components/search/SearchBar";
import { FilterRail } from "@/components/filters/FilterRail";
import { GymCard } from "@/components/gym/GymCard";
import { EmptyState } from "@/components/ui/EmptyState";
import { MapView } from "@/components/map/MapView";

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
  const [view, setView] = useState<"list" | "map">("list");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const scored = useMemo(() => scoreGyms(gyms, filters), [gyms, filters]);
  const filtersActive = !isEmptyFilterSet(filters);
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
        apply: () => patch({ segments: filters.segments.filter((s) => s !== seg) }),
      });
    }
    if (filters.neighborhood) {
      chips.push({
        label: "Search all of Tampa",
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
  }, [filters, setFilters]);
  const showWeakBanner =
    filtersActive &&
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

  return (
    <div className="flex flex-1 flex-col">
      {/* hero strip — compact: the product is the results, not the banner */}
      <section className="survey-grid-night bg-ink-deep">
        <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 sm:py-7">
          <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
            <h1 className="display text-3xl text-paper sm:text-4xl">
              Find your <span className="text-blaze">fit.</span>
            </h1>
            <p className="readout text-pool">
              Tampa quadrant · 27.9506° N · 82.4572° W
            </p>
          </div>
          <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-mist">
            The equipment, amenities, and hours that actually matter — type it or say it.
          </p>
          <div className="mt-4 max-w-2xl">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* controls row — sticky so count/query/view never scroll away */}
      <div className="sticky top-16 z-30 border-b border-paper-line bg-paper-raise/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
          <span className="font-mono text-xs uppercase tracking-wider text-ink">
            {scored.length} {scored.length === 1 ? "gym" : "gyms"}
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
            </button>
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

      {/* main */}
      <div className="survey-grid mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
        <div className="flex gap-6">
          <aside className="hidden w-64 shrink-0 lg:block">
            <div className="sticky top-20">
              <FilterRail resultCount={scored.length} />
            </div>
          </aside>

          <main className="min-w-0 flex-1">
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
              scored.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {scored.map((gym) => (
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
                  description="Try loosening a filter or two — or clear the search and browse the whole Tampa quadrant."
                  action={{ label: "Clear filters", onClick: resetFilters }}
                />
              )
            ) : (
              <div className="h-[calc(100dvh-230px)] min-h-[520px] overflow-hidden rounded-xl border border-ink-line">
                <MapView
                  gyms={scored}
                  selectedGymId={highlightedId}
                  onGymSelect={handleGymSelect}
                  center={[city.lng, city.lat]}
                />
              </div>
            )}
          </main>
        </div>
      </div>

      {/* mobile filter drawer */}
      {mobileFilters && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Filters">
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
                autoFocus
                onClick={() => setMobileFilters(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-paper-line text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <FilterRail resultCount={scored.length} collapsible />
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
    </div>
  );
}
