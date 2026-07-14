"use client";

import { X } from "lucide-react";
import {
  AMENITY_LABELS,
  EQUIPMENT_LABELS,
  SEGMENT_LABELS,
  VIBE_LABELS,
  type FilterSet,
} from "@/lib/types/scout";
import { useFilterStore } from "@/stores/filterStore";

interface Chip {
  key: string;
  label: string;
  /** Soft (AI-suggested, never-excluding) members render dashed, matching
   *  the "~" convention set by SegmentIconRow. */
  soft?: boolean;
  onRemove: () => void;
}

/**
 * One removable chip per active FilterSet member, plus a travel chip.
 * Complements — does NOT replace — the existing rawQuery pill and Clear-all
 * (sticky bar / FilterRail): this is the "what exactly is applied, and can I
 * pull just this one thread" view, not a duplicate of either.
 */
export function AppliedFilterChips() {
  const filters = useFilterStore((s) => s.filters);
  const travel = useFilterStore((s) => s.travel);
  const setFilters = useFilterStore((s) => s.setFilters);
  const setTravel = useFilterStore((s) => s.setTravel);

  // read fresh state at click time — memoized closures must not race when
  // two chips are removed before the next render (same pattern as
  // DiscoveryClient's relaxChips / FilterRail's patch).
  const patch = (p: Partial<FilterSet>) =>
    setFilters({ ...useFilterStore.getState().filters, ...p });
  const patchEquipment = (p: Partial<FilterSet["equipment"]>) =>
    patch({ equipment: { ...useFilterStore.getState().filters.equipment, ...p } });

  const chips: Chip[] = [];

  for (const key of filters.amenities) {
    chips.push({
      key: `amenity-${key}`,
      label: AMENITY_LABELS[key],
      onRemove: () =>
        patch({
          amenities: useFilterStore.getState().filters.amenities.filter((a) => a !== key),
        }),
    });
  }
  for (const key of filters.equipment.keys) {
    chips.push({
      key: `equipment-${key}`,
      label: EQUIPMENT_LABELS[key],
      onRemove: () =>
        patchEquipment({
          keys: useFilterStore.getState().filters.equipment.keys.filter((k) => k !== key),
        }),
    });
  }
  if (filters.equipment.minSquatRacks !== null) {
    chips.push({
      key: "minSquatRacks",
      label: `${filters.equipment.minSquatRacks}+ squat racks`,
      onRemove: () => patchEquipment({ minSquatRacks: null }),
    });
  }
  if (filters.equipment.minDumbbellWeight !== null) {
    chips.push({
      key: "minDumbbellWeight",
      label: `Dumbbells to ${filters.equipment.minDumbbellWeight}+ lbs`,
      onRemove: () => patchEquipment({ minDumbbellWeight: null }),
    });
  }
  for (const b of filters.equipment.brands) {
    chips.push({
      key: `brand-${b}`,
      label: b,
      onRemove: () =>
        patchEquipment({
          brands: useFilterStore.getState().filters.equipment.brands.filter((x) => x !== b),
        }),
    });
  }
  if (filters.maxDayPass !== null) {
    chips.push({
      key: "maxDayPass",
      label: `≤ $${filters.maxDayPass} day pass`,
      onRemove: () => patch({ maxDayPass: null }),
    });
  }
  if (filters.openNow) {
    chips.push({ key: "openNow", label: "Open now", onRemove: () => patch({ openNow: false }) });
  }
  if (filters.open24h) {
    chips.push({
      key: "open24h",
      label: "24-hour access",
      onRemove: () => patch({ open24h: false }),
    });
  }
  if (filters.neighborhood) {
    chips.push({
      key: "neighborhood",
      label: filters.neighborhood,
      onRemove: () => patch({ neighborhood: null }),
    });
  }
  for (const seg of filters.segments) {
    chips.push({
      key: `segment-${seg}`,
      label: SEGMENT_LABELS[seg],
      onRemove: () =>
        patch({ segments: useFilterStore.getState().filters.segments.filter((s) => s !== seg) }),
    });
  }
  for (const seg of filters.preferredSegments) {
    chips.push({
      key: `pref-segment-${seg}`,
      label: SEGMENT_LABELS[seg],
      soft: true,
      onRemove: () =>
        patch({
          preferredSegments: useFilterStore
            .getState()
            .filters.preferredSegments.filter((s) => s !== seg),
        }),
    });
  }
  for (const vibe of filters.preferredVibes) {
    chips.push({
      key: `vibe-${vibe}`,
      label: VIBE_LABELS[vibe],
      soft: true,
      onRemove: () =>
        patch({
          preferredVibes: useFilterStore
            .getState()
            .filters.preferredVibes.filter((v) => v !== vibe),
        }),
    });
  }
  if (travel) {
    chips.push({
      key: "travel",
      label: `${travel.minutes} min ${travel.mode === "driving" ? "drive" : "walk"}`,
      onRemove: () => setTravel(null),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-3 sm:px-6">
      <div className="flex flex-wrap gap-1.5" role="list" aria-label="Applied filters">
        {chips.map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={chip.onRemove}
            role="listitem"
            className={`font-mono inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-wide transition-colors ${
              chip.soft
                ? "border-dashed border-pool-deep bg-pool-tint/60 text-ink hover:bg-pool-tint"
                : "border-ink/20 bg-paper-raise text-ink/80 hover:border-ink/40"
            }`}
          >
            {chip.soft ? "~ " : ""}
            {chip.label}
            <X className="h-3 w-3" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
