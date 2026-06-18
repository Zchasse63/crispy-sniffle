"use client";

import { Check } from "lucide-react";
import type { FieldOption } from "@/lib/owner/formConfig";

/** Single-select chips (radio behavior). null = skipped. Tapping the active
 *  chip again clears it back to null (skip is always reachable). */
export function ChipSingle({
  options,
  value,
  prefillValue,
  onChange,
}: {
  options: FieldOption[];
  value: string | null;
  prefillValue: string | null;
  onChange: (next: string | null) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const active = value === o.key;
        const prefilled = prefillValue === o.key;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(active ? null : o.key)}
            className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] transition-colors ${
              active
                ? "border-ink bg-ink text-paper"
                : "border-contour-deep/60 bg-paper-raise text-ink/85 hover:border-ink/40"
            }`}
          >
            {active && <Check className="h-3 w-3" strokeWidth={3} aria-hidden />}
            <span>{o.label}</span>
            {active && prefilled && (
              <span className="ml-0.5 h-1.5 w-1.5 rounded-full bg-paper/70" title="from your website" aria-hidden />
            )}
          </button>
        );
      })}
    </div>
  );
}
