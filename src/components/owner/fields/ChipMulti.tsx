"use client";

import { Check, X } from "lucide-react";
import type { FieldOption } from "@/lib/owner/formConfig";

/**
 * Multi-select chip wall. Three meaningful states:
 *  - active            → owner says present
 *  - active + prefill  → confirmed from public data (pool dot)
 *  - removed (prefill, now off) → owner says ABSENT (the only path to present:false)
 *  - idle              → untouched (stays "unlisted", never assumed false)
 */
export function ChipMulti({
  options,
  value,
  prefillSelected,
  onChange,
  maxSelect,
}: {
  options: FieldOption[];
  value: string[];
  prefillSelected: string[];
  onChange: (next: string[]) => void;
  maxSelect?: number;
}) {
  const atMax = maxSelect != null && value.length >= maxSelect;

  const toggle = (key: string) => {
    if (value.includes(key)) onChange(value.filter((k) => k !== key));
    else if (!atMax) onChange([...value, key]);
  };

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = value.includes(o.key);
          const prefilled = prefillSelected.includes(o.key);
          const removed = !active && prefilled;
          const disabled = !active && atMax;
          return (
            <button
              key={o.key}
              type="button"
              onClick={() => toggle(o.key)}
              disabled={disabled}
              className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
                active
                  ? "border-blaze bg-blaze text-white"
                  : removed
                    ? "border-contour-deep/50 bg-paper text-ink/40 line-through"
                    : disabled
                      ? "cursor-not-allowed border-paper-line bg-paper text-ink/30"
                      : "border-contour-deep/60 bg-paper-raise text-ink/85 hover:border-ink/40"
              }`}
              title={removed ? "Marked as not available — tap to add back" : undefined}
            >
              {active && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
              {removed && <X className="h-3 w-3" aria-hidden />}
              <span>{o.label}</span>
              {active && prefilled && (
                <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-paper/70" title="from your website" aria-hidden />
              )}
            </button>
          );
        })}
      </div>
      {maxSelect != null && (
        <p className="readout mt-2 text-ink/45">
          {value.length}/{maxSelect} selected
        </p>
      )}
    </div>
  );
}
