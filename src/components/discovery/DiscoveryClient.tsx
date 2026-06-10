"use client";

import { useMemo, useState } from "react";
import { List, Map as MapIcon, SlidersHorizontal, Sparkles, Wrench, X } from "lucide-react";
import type { City, EnrichedGym } from "@/lib/types/scout";
import { isEmptyFilterSet } from "@/lib/types/scout";
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
  const [view, setView] = useState<"list" | "map">("list");
  const [mobileFilters, setMobileFilters] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);

  const scored = useMemo(() => scoreGyms(gyms, filters), [gyms, filters]);
  const filtersActive = !isEmptyFilterSet(filters);

  return (
    <div className="flex flex-1 flex-col">
      {/* hero strip */}
      <section className="survey-grid-night bg-ink-deep">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="readout text-pool">
            Tampa quadrant · 27.9506° N · 82.4572° W
          </p>
          <h1 className="display mt-2 text-4xl text-paper sm:text-6xl">
            Find your <span className="text-blaze">fit.</span>
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-mist">
            Scout scans the landscape of gyms and surfaces the right one for you —
            the equipment, amenities, and hours that actually matter. Type it or say it.
          </p>
          <div className="mt-6 max-w-2xl">
            <SearchBar />
          </div>
        </div>
      </section>

      {/* controls row */}
      <div className="border-b border-paper-line bg-paper-raise">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
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
              className="readout inline-flex items-center gap-1 rounded-full border border-contour bg-paper px-2.5 py-1 text-ink/60"
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
            {view === "list" ? (
              scored.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
              <div className="h-[640px] overflow-hidden rounded-xl border border-ink-line">
                <MapView
                  gyms={scored}
                  selectedGymId={highlightedId}
                  onGymSelect={setHighlightedId}
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
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-paper p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <span className="display text-lg text-ink">Filters</span>
              <button
                type="button"
                onClick={() => setMobileFilters(false)}
                aria-label="Close"
                className="flex h-9 w-9 items-center justify-center rounded-md border border-paper-line text-ink"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <FilterRail resultCount={scored.length} />
          </div>
        </div>
      )}
    </div>
  );
}
