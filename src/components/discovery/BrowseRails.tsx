"use client";

import { Clock, DollarSign, Dumbbell, type LucideIcon } from "lucide-react";
import { useFilterStore } from "@/stores/filterStore";

/**
 * Empty-filter browse accelerators — one tap from "just show me something
 * good" to a scoped or re-sorted list. Styled like SegmentIconRow (a
 * full-width chip row, not the aside rail). Rendered only while the
 * FilterSet is empty; the "Open now" chip's own click makes it non-empty,
 * so the row naturally steps aside once it's done its job.
 */
export function BrowseRails() {
  const filters = useFilterStore((s) => s.filters);
  const sortBy = useFilterStore((s) => s.sortBy);
  const setFilters = useFilterStore((s) => s.setFilters);
  const setSortBy = useFilterStore((s) => s.setSortBy);

  const toggleOpenNow = () => {
    const cur = useFilterStore.getState().filters;
    setFilters({ ...cur, openNow: !cur.openNow });
  };
  const toggleSort = (target: "price_asc" | "equipped") => {
    setSortBy(useFilterStore.getState().sortBy === target ? "match" : target);
  };

  const chips: {
    key: string;
    label: string;
    icon: LucideIcon;
    active: boolean;
    onClick: () => void;
    title?: string;
  }[] = [
    {
      key: "open-now",
      label: "Open now",
      icon: Clock,
      active: filters.openNow,
      onClick: toggleOpenNow,
    },
    {
      key: "cheapest",
      label: "Cheapest day passes",
      icon: DollarSign,
      active: sortBy === "price_asc",
      onClick: () => toggleSort("price_asc"),
    },
    {
      key: "best-equipped",
      label: "Best equipped",
      icon: Dumbbell,
      active: sortBy === "equipped",
      onClick: () => toggleSort("equipped"),
      title: "Ranked by equipment variety on file — not a verified quality score",
    },
  ];

  return (
    <nav aria-label="Browse shortcuts" className="border-b border-paper-line bg-paper-raise/60">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-1.5 px-4 py-2.5 sm:px-6 md:gap-2">
        {chips.map(({ key, label, icon: Icon, active, onClick, title }) => (
          <button
            key={key}
            type="button"
            onClick={onClick}
            aria-pressed={active}
            title={title}
            className={`readout flex items-center gap-1.5 rounded-full border px-3 py-1.5 transition-colors ${
              active
                ? "border-ink bg-ink text-paper"
                : "border-paper-line text-ink/70 hover:border-ink/40 hover:text-ink"
            }`}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
            {label}
          </button>
        ))}
      </div>
    </nav>
  );
}
