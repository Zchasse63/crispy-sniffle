import { Check, X as XIcon } from "lucide-react";
import { ProvenanceBadge } from "./ProvenanceBadge";
import type { ProvenanceSource } from "@/lib/types/scout";

export interface AttributeItem {
  key: string;
  label: string;
  value: string | null; // e.g. "6 racks · Rogue", "to 150 lbs"
  present: boolean;
  source: ProvenanceSource;
  confidence: number;
  detail: string | null;
}

/** Grouped facts with visible provenance — Scout never hides where data came from. */
export function AttributeSection({
  title,
  items,
}: {
  title: string;
  items: AttributeItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="rounded-xl border border-paper-line bg-paper-raise p-5">
      <h2 className="readout text-ink/50">{title}</h2>
      <ul className="mt-3 divide-y divide-paper-line/60">
        {items.map((item) => (
          <li
            key={item.key}
            className={`flex items-center justify-between gap-3 py-2.5 ${
              item.present ? "" : "opacity-50"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2.5 text-sm text-ink">
              {item.present ? (
                <Check className="h-4 w-4 shrink-0 text-pool" aria-hidden />
              ) : (
                <XIcon className="h-4 w-4 shrink-0 text-contour" aria-hidden />
              )}
              <span className="truncate">
                {item.label}
                {item.value && (
                  <span className="font-mono ml-2 text-xs uppercase tracking-wide text-ink/60">
                    {item.value}
                  </span>
                )}
              </span>
            </span>
            <ProvenanceBadge
              source={item.source}
              confidence={item.confidence}
              detail={item.detail}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}
