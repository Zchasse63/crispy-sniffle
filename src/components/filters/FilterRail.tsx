"use client";

import { Check, ChevronDown, Minus, Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import {
  EQUIPMENT_LABELS,
  SEGMENT_LABELS,
  isEmptyFilterSet,
  type AmenityKey,
  type EquipmentKey,
  type FilterSet,
} from "@/lib/types/scout";
import { NEIGHBORHOOD_SYNONYMS } from "@/lib/search/synonyms";
import { useFilterStore } from "@/stores/filterStore";
import { NearMeFilter } from "./NearMeFilter";

const RAIL_AMENITIES: { key: AmenityKey; label: string }[] = [
  { key: "sauna", label: "Sauna" },
  { key: "cold_plunge", label: "Cold Plunge" },
  { key: "steam_room", label: "Steam Room" },
  { key: "pool", label: "Pool" },
  { key: "recovery_room", label: "Recovery Room" },
  { key: "classes", label: "Group Classes" },
  { key: "personal_training", label: "Personal Training" },
  { key: "turf_area", label: "Turf Area" },
  { key: "basketball_court", label: "Basketball" },
  { key: "towel_service", label: "Towel Service" },
  { key: "childcare", label: "Childcare" },
  { key: "parking", label: "Parking" },
];

const RAIL_EQUIPMENT: EquipmentKey[] = [
  "squat_rack",
  "platform",
  "dumbbells",
  "ghd",
  "sled",
  "ski_erg",
  "assault_bike",
  "rower",
  "reverse_hyper",
  "belt_squat",
  "cable_machine",
  "leg_press",
];

const NEIGHBORHOODS = Object.keys(NEIGHBORHOOD_SYNONYMS);

function Section({
  title,
  children,
  collapsible = false,
  defaultOpen = false,
  hasActive = false,
}: {
  title: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  /** Auto-open when this section holds active selections (e.g. set by AI
   *  parsing) so users can SEE what their search selected. */
  hasActive?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen || hasActive);
  useEffect(() => {
    if (hasActive) setOpen(true);
  }, [hasActive]);
  if (collapsible) {
    return (
      <details
        open={open}
        onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
        className="group border-b border-paper-line py-3 last:border-b-0"
      >
        <summary className="readout flex cursor-pointer list-none items-center justify-between py-1 text-ink/70 [&::-webkit-details-marker]:hidden">
          {title}
          <ChevronDown
            className="h-4 w-4 transition-transform group-open:rotate-180"
            aria-hidden
          />
        </summary>
        <div className="pt-2.5">{children}</div>
      </details>
    );
  }
  return (
    <section className="border-b border-paper-line py-4 first:pt-0 last:border-b-0">
      <h3 className="readout mb-3 text-ink/70">{title}</h3>
      {children}
    </section>
  );
}

function CheckRow({
  checked,
  label,
  onToggle,
}: {
  checked: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 rounded px-1 py-1 text-[13px] text-ink/85 transition-colors hover:bg-paper">
      <input type="checkbox" checked={checked} onChange={onToggle} className="sr-only" />
      <span
        aria-hidden
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border transition-colors ${
          checked ? "border-blaze bg-blaze text-white" : "border-contour-deep/60 bg-paper-raise"
        }`}
      >
        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
      </span>
      {label}
    </label>
  );
}

function Stepper({
  value,
  onChange,
  unit,
  step = 1,
  max,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  unit: string;
  step?: number;
  max: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Decrease"
        onClick={() => onChange(value === null ? null : value - step <= 0 ? null : value - step)}
        className="flex h-7 w-7 items-center justify-center rounded border border-paper-line bg-paper-raise text-ink/70 hover:border-ink/40"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span className="font-mono min-w-16 text-center text-xs uppercase tracking-wide text-ink">
        {value === null ? "Any" : `${value}+ ${unit}`}
      </span>
      <button
        type="button"
        aria-label="Increase"
        onClick={() => onChange(Math.min(value === null ? step : value + step, max))}
        className="flex h-7 w-7 items-center justify-center rounded border border-paper-line bg-paper-raise text-ink/70 hover:border-ink/40"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
    </div>
  );
}

export function FilterRail({
  resultCount,
  collapsible = false,
}: {
  resultCount: number;
  collapsible?: boolean;
}) {
  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);
  const resetFilters = useFilterStore((s) => s.resetFilters);
  const [brandInput, setBrandInput] = useState("");

  // read fresh state at event time — render-captured `filters` can be one
  // update behind on rapid successive interactions
  const patch = (p: Partial<FilterSet>) =>
    setFilters({ ...useFilterStore.getState().filters, ...p });
  const patchEquipment = (p: Partial<FilterSet["equipment"]>) =>
    patch({ equipment: { ...useFilterStore.getState().filters.equipment, ...p } });

  const toggleAmenity = (key: AmenityKey) =>
    patch({
      amenities: filters.amenities.includes(key)
        ? filters.amenities.filter((a) => a !== key)
        : [...filters.amenities, key],
    });

  const toggleEquipment = (key: EquipmentKey) =>
    patchEquipment({
      keys: filters.equipment.keys.includes(key)
        ? filters.equipment.keys.filter((k) => k !== key)
        : [...filters.equipment.keys, key],
    });


  const addBrand = () => {
    const b = brandInput.trim();
    if (b && !filters.equipment.brands.some((x) => x.toLowerCase() === b.toLowerCase())) {
      patchEquipment({ brands: [...filters.equipment.brands, b] });
    }
    setBrandInput("");
  };

  const active = !isEmptyFilterSet(filters);

  return (
    <div className="rounded-xl border border-paper-line bg-paper-raise p-4">
      <div className="flex items-center justify-between pb-3">
        <span className="font-mono text-xs uppercase tracking-wider text-ink">
          {resultCount} {resultCount === 1 ? "gym" : "gyms"}
        </span>
        {active && (
          <button
            type="button"
            onClick={resetFilters}
            className="readout flex items-center gap-1 rounded px-1.5 py-1 text-blaze-deep hover:bg-blaze-tint"
          >
            <X className="h-3 w-3" aria-hidden /> Clear all
          </button>
        )}
      </div>

      <Section title="Near me" collapsible={collapsible} defaultOpen>
        <NearMeFilter />
      </Section>

      <Section title="Amenities" collapsible={collapsible} hasActive={filters.amenities.length > 0}>
        <div className="grid grid-cols-1 gap-0.5">
          {RAIL_AMENITIES.map(({ key, label }) => (
            <CheckRow
              key={key}
              label={label}
              checked={filters.amenities.includes(key)}
              onToggle={() => toggleAmenity(key)}
            />
          ))}
        </div>
      </Section>

      <Section title="Equipment" collapsible={collapsible} hasActive={filters.equipment.keys.length > 0 || filters.equipment.minSquatRacks !== null || filters.equipment.minDumbbellWeight !== null || filters.equipment.brands.length > 0}>
        <div className="grid grid-cols-1 gap-0.5">
          {RAIL_EQUIPMENT.map((key) => (
            <CheckRow
              key={key}
              label={EQUIPMENT_LABELS[key]}
              checked={filters.equipment.keys.includes(key)}
              onToggle={() => toggleEquipment(key)}
            />
          ))}
        </div>
        <div className="mt-3 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink/70">Squat racks</span>
            <Stepper
              value={filters.equipment.minSquatRacks}
              onChange={(v) => patchEquipment({ minSquatRacks: v })}
              unit="racks"
              max={12}
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs text-ink/70">Dumbbells to</span>
            <Stepper
              value={filters.equipment.minDumbbellWeight}
              onChange={(v) => patchEquipment({ minDumbbellWeight: v })}
              unit="lbs"
              step={25}
              max={250}
            />
          </div>
        </div>
        <div className="mt-3">
          <div className="flex gap-1.5">
            <input
              type="text"
              value={brandInput}
              onChange={(e) => setBrandInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addBrand();
                }
              }}
              placeholder="Brand (e.g. Rogue)"
              aria-label="Add equipment brand filter"
              className="font-mono w-full rounded border border-paper-line bg-paper px-2 py-1.5 text-xs text-ink placeholder:text-ink/40 focus:border-ink/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={addBrand}
              aria-label="Add brand"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-paper-line bg-paper-raise text-ink/70 hover:border-ink/40"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
          {filters.equipment.brands.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {filters.equipment.brands.map((b) => (
                <button
                  key={b}
                  type="button"
                  onClick={() =>
                    patchEquipment({
                      brands: filters.equipment.brands.filter((x) => x !== b),
                    })
                  }
                  className="font-mono inline-flex items-center gap-1 rounded-full bg-ink px-2 py-0.5 text-[10.5px] uppercase tracking-wide text-paper"
                >
                  {b} <X className="h-3 w-3" aria-hidden />
                </button>
              ))}
            </div>
          )}
        </div>
      </Section>

      <Section title="Day pass" collapsible={collapsible} hasActive={filters.maxDayPass !== null}>
        <div className="px-1">
          <input
            type="range"
            min={5}
            max={60}
            step={5}
            value={filters.maxDayPass ?? 60}
            onChange={(e) => {
              const v = Number(e.target.value);
              patch({ maxDayPass: v >= 60 ? null : v });
            }}
            aria-label="Maximum day pass price"
            className={`w-full ${
              filters.maxDayPass === null
                ? "accent-contour opacity-70" // inactive: neutral, no false signal
                : "accent-blaze-deep"
            }`}
          />
          <div className="font-mono mt-1 flex justify-between text-[10.5px] uppercase tracking-wide text-ink/70">
            <span>$5</span>
            <span className="text-ink">
              {filters.maxDayPass === null ? "Any price" : `≤ $${filters.maxDayPass}`}
            </span>
            <span>$60+</span>
          </div>
        </div>
      </Section>

      <Section title="Hours" collapsible={collapsible} hasActive={filters.openNow || filters.open24h}>
        <div className="grid grid-cols-1 gap-0.5">
          <CheckRow
            label="Open now"
            checked={filters.openNow}
            onToggle={() => patch({ openNow: !filters.openNow })}
          />
          <CheckRow
            label="24-hour access"
            checked={filters.open24h}
            onToggle={() => patch({ open24h: !filters.open24h })}
          />
        </div>
      </Section>

      <Section title="Neighborhood" collapsible={collapsible} hasActive={filters.neighborhood !== null}>
        <select
          value={filters.neighborhood ?? ""}
          onChange={(e) => patch({ neighborhood: e.target.value || null })}
          aria-label="Neighborhood"
          className="font-mono w-full rounded border border-paper-line bg-paper px-2 py-2 text-xs uppercase tracking-wide text-ink focus:border-ink/40 focus:outline-none"
        >
          <option value="">All of Tampa</option>
          {NEIGHBORHOODS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </Section>
    </div>
  );
}
