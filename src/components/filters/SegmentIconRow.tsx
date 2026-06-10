"use client";

import {
  Building2,
  Crown,
  Dumbbell,
  Flame,
  Flower2,
  Mountain,
  Snowflake,
  Sparkles,
  Swords,
} from "lucide-react";
import { SEGMENT_LABELS, type GymSegment } from "@/lib/types/scout";
import { useFilterStore } from "@/stores/filterStore";

const SEGMENT_ICONS: Record<GymSegment, React.ComponentType<{ className?: string }>> = {
  strength: Dumbbell,
  crossfit: Flame,
  big_box: Building2,
  boutique: Sparkles,
  climbing: Mountain,
  yoga_pilates: Flower2,
  mma: Swords,
  recovery: Snowflake,
  luxury: Crown,
};

const ORDER: GymSegment[] = [
  "strength",
  "crossfit",
  "big_box",
  "boutique",
  "luxury",
  "climbing",
  "yoga_pilates",
  "mma",
  "recovery",
];

/**
 * Gym types as a full-width icon row under the hero — the rail stays clean
 * for amenities/equipment. Click = HARD filter toggle (explicit user action);
 * AI-suggested soft preferences show as dashed "~" chips, one tap to promote.
 */
export function SegmentIconRow() {
  const filters = useFilterStore((s) => s.filters);
  const setFilters = useFilterStore((s) => s.setFilters);

  const toggle = (seg: GymSegment) => {
    const current = useFilterStore.getState().filters;
    const on = current.segments.includes(seg);
    setFilters({
      ...current,
      segments: on
        ? current.segments.filter((s) => s !== seg)
        : [...current.segments, seg],
      // explicit action supersedes the AI's soft suggestion for this segment
      preferredSegments: current.preferredSegments.filter((s) => s !== seg),
    });
  };

  return (
    <nav
      aria-label="Gym types"
      className="border-b border-paper-line bg-paper-raise/80 backdrop-blur-sm"
    >
      <div className="mx-auto flex max-w-7xl items-stretch gap-1 overflow-x-auto px-4 py-2 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {ORDER.map((seg) => {
          const Icon = SEGMENT_ICONS[seg];
          const hard = filters.segments.includes(seg);
          const soft = !hard && filters.preferredSegments.includes(seg);
          return (
            <button
              key={seg}
              type="button"
              onClick={() => toggle(seg)}
              aria-pressed={hard}
              title={
                soft
                  ? `${SEGMENT_LABELS[seg]} — suggested by your search; tap to require`
                  : SEGMENT_LABELS[seg]
              }
              className={`flex min-w-[76px] shrink-0 flex-col items-center gap-1 rounded-lg border px-2.5 py-2 transition-colors ${
                hard
                  ? "border-ink bg-ink text-paper"
                  : soft
                    ? "border-dashed border-pool-deep bg-pool-tint/60 text-ink"
                    : "border-transparent text-ink/70 hover:border-paper-line hover:bg-paper hover:text-ink"
              }`}
            >
              <Icon className="h-4.5 w-4.5" aria-hidden />
              <span className="font-mono text-[9.5px] uppercase leading-tight tracking-wide">
                {SEGMENT_LABELS[seg].split(" & ")[0].split(" ")[0]}
                {soft ? " ~" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
