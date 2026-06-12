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

/** Row-fit labels — the full SEGMENT_LABELS stay on cards/filters. */
const SHORT_LABELS: Record<GymSegment, string> = {
  strength: "Strength",
  crossfit: "CrossFit",
  big_box: "Big Box",
  boutique: "Boutique",
  luxury: "Luxury",
  climbing: "Climbing",
  yoga_pilates: "Yoga",
  mma: "MMA",
  recovery: "Recovery",
};

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
      {/* outer scrolls on small screens (edge-fade affordance); the w-max
          inner track self-centers whenever the row fits the container */}
      <div className="overflow-x-auto px-4 py-2.5 sm:px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden [mask-image:linear-gradient(to_right,transparent,black_20px,black_calc(100%-20px),transparent)] md:[mask-image:none]">
        <div className="mx-auto flex w-max items-stretch gap-1.5 md:gap-2">
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
                className={`flex min-w-[84px] shrink-0 flex-col items-center gap-1.5 rounded-lg border px-3 py-2.5 transition-colors ${
                  hard
                    ? "border-ink bg-ink text-paper"
                    : soft
                      ? "border-dashed border-pool-deep bg-pool-tint/60 text-ink"
                      : "border-transparent text-ink/70 hover:border-paper-line hover:bg-paper hover:text-ink"
                }`}
              >
                <Icon className="h-5 w-5" aria-hidden />
                <span className="font-mono text-[10px] uppercase leading-tight tracking-wide">
                  {SHORT_LABELS[seg]}
                  {soft ? " ~" : ""}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
