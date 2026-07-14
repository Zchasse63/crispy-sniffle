"use client";

import { Check } from "lucide-react";
import type { EnrichedGym } from "@/lib/types/scout";

/**
 * Chip row for choosing which 3 (of >3 saved) gyms populate the compare
 * table. Page-local, non-destructive: toggling a chip only changes which
 * columns render — it NEVER writes to shortlistStore. Selecting a 4th chip
 * while 3 are already active evicts the oldest-selected one (FIFO), handled
 * by the caller's onToggle.
 */
export function ComparePicker({
  gyms,
  selectedIds,
  onToggle,
}: {
  gyms: EnrichedGym[];
  selectedIds: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="mt-4">
      <div className="flex flex-wrap gap-2">
        {gyms.map((g) => {
          const active = selectedIds.includes(g.id);
          return (
            <button
              key={g.id}
              type="button"
              onClick={() => onToggle(g.id)}
              aria-pressed={active}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                active
                  ? "border-blaze bg-blaze text-white"
                  : "border-contour-deep/60 bg-paper-raise text-ink/75 hover:border-ink/40"
              }`}
            >
              {active && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
              <span>{g.name}</span>
            </button>
          );
        })}
      </div>
      <p className="readout mt-2 text-ink/45">
        {selectedIds.length}/3 selected — tap a chip to swap it into the table below
      </p>
    </div>
  );
}
