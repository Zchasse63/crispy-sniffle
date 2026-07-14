"use client";

import { create } from "zustand";
import { EMPTY_FILTER_SET, type FilterSet } from "@/lib/types/scout";
import type { LngLat, TravelMode } from "@/lib/travel";

/** Geographic "within X minutes" pre-filter. Deliberately OUTSIDE FilterSet:
 *  FilterSet is the scoring/AI contract; travel reach is an orthogonal
 *  geographic axis (like the map viewport), applied before scoring. */
export interface TravelFilter {
  minutes: number;
  mode: TravelMode;
  origin: LngLat;
  polygon: number[][][][]; // MultiPolygon: array of [shell, ...holes]
}

/** Display-order preference. Deliberately OUTSIDE FilterSet for the same
 *  reason TravelFilter is: it re-orders scoreGyms' OUTPUT in DiscoveryClient
 *  and never reaches the scoring/AI contract — nlParser, ai-search, and
 *  scorer.ts never see this field. */
export type SortBy = "match" | "price_asc" | "distance" | "equipped";

export const SORT_LABELS: Record<SortBy, string> = {
  match: "Best match",
  price_asc: "Price: low to high",
  distance: "Distance: nearest",
  equipped: "Best equipped",
};

interface FilterState {
  filters: FilterSet;
  travel: TravelFilter | null;
  sortBy: SortBy;
  /** True while the NL query is being parsed (edge fn round-trip). */
  isParsing: boolean;
  /** 'ai' = parsed by Claude · 'fallback' = local parser · null = manual filters */
  parsedVia: "ai" | "fallback" | null;
  setFilters: (f: FilterSet, via?: "ai" | "fallback" | null) => void;
  updateFilter: <K extends keyof FilterSet>(key: K, value: FilterSet[K]) => void;
  resetFilters: () => void;
  setParsing: (v: boolean) => void;
  setTravel: (t: TravelFilter | null) => void;
  setSortBy: (s: SortBy) => void;
}

/** Session-only on purpose: persisted filters resurface as stale, confusing state. */
export const useFilterStore = create<FilterState>()((set) => ({
  filters: EMPTY_FILTER_SET,
  travel: null,
  sortBy: "match",
  isParsing: false,
  parsedVia: null,
  setFilters: (filters, via = null) => set({ filters, parsedVia: via }),
  updateFilter: (key, value) =>
    set((s) => ({
      filters: { ...s.filters, [key]: value },
      parsedVia: null,
    })),
  resetFilters: () =>
    set({ filters: EMPTY_FILTER_SET, parsedVia: null, travel: null, sortBy: "match" }),
  setParsing: (isParsing) => set({ isParsing }),
  setTravel: (travel) => set({ travel }),
  setSortBy: (sortBy) => set({ sortBy }),
}));
