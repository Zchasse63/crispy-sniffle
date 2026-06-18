"use client";

import { Minus, Plus } from "lucide-react";

/** Integer stepper. null = unset/"any" (distinct from 0). */
export function StepperField({
  value,
  onChange,
  min = 0,
  max = 999,
  step = 1,
  unit,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}) {
  const current = value ?? 0;
  const set = (n: number) => onChange(Math.max(min, Math.min(max, n)));

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        // null means "unlisted" — decrementing must NOT assert a 0 (never-fabricate).
        onClick={() => {
          if (value == null) return;
          set(current - step);
        }}
        disabled={value == null}
        className="flex h-8 w-8 items-center justify-center rounded border border-paper-line bg-paper-raise text-ink/70 hover:border-ink/40 disabled:opacity-40"
        aria-label="Decrease"
      >
        <Minus className="h-3.5 w-3.5" aria-hidden />
      </button>
      <span className="font-mono min-w-20 text-center text-sm uppercase tracking-wide text-ink">
        {value == null ? "—" : `${value}${unit ? ` ${unit}` : ""}`}
      </span>
      <button
        type="button"
        onClick={() => (value == null ? onChange(min + step) : set(current + step))}
        className="flex h-8 w-8 items-center justify-center rounded border border-paper-line bg-paper-raise text-ink/70 hover:border-ink/40"
        aria-label="Increase"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden />
      </button>
      {value != null && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="readout ml-1 text-ink/45 hover:text-blaze-deep"
        >
          Clear
        </button>
      )}
    </div>
  );
}
