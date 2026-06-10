import { BadgeCheck, Check, X as XIcon } from "lucide-react";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { FactConfirm } from "@/components/community/FactConfirm";
import { MACHINE_KEYS } from "@/lib/types/scout";
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

/** A badge only earns its place when it INFORMS — estimates and upgrades
 *  show; baseline curated facts are summarized once at section level. */
const showBadge = (item: AttributeItem) =>
  item.source !== "seed" || item.confidence < 0.7;

/** Grouped facts with visible provenance — Scout never hides where data came from. */
export function AttributeSection({
  title,
  items,
  gymId,
  factType,
  confirmCounts,
}: {
  title: string;
  items: AttributeItem[];
  /** When provided, rows gain community confirm/correct controls. */
  gymId?: string;
  factType?: "amenity" | "equipment";
  confirmCounts?: Record<string, number>;
}) {
  if (items.length === 0) return null;
  const allCurated = items.every((i) => !showBadge(i));
  return (
    <section className="rounded-xl border border-paper-line bg-paper-raise p-5">
      <div className="flex items-center justify-between">
        <h2 className="readout flex items-center text-ink/70">
          {title}
          {items.some((i) => (MACHINE_KEYS as string[]).includes(i.key)) && (
            <span
              className="font-mono ml-2 rounded border border-pool/50 bg-pool-tint/70 px-1.5 py-0.5 text-[9px] uppercase tracking-wider text-pool-deep"
              title="Machine-level detail is a Scout Pro feature — free during the beta"
            >
              Pro preview
            </span>
          )}
        </h2>
        {allCurated && (
          <span
            className="readout inline-flex items-center gap-1 text-pool-deep"
            title="All facts in this section come from Scout's curated research"
          >
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Scout curated
          </span>
        )}
      </div>
      <ul className="mt-3 divide-y divide-paper-line/60">
        {items.map((item) => (
          <li
            key={item.key}
            className={`group/fact flex items-center justify-between gap-3 py-2.5 ${
              item.present ? "" : "opacity-50"
            }`}
          >
            <span className="flex min-w-0 items-center gap-2.5 text-sm text-ink">
              {item.present ? (
                <Check className="h-4 w-4 shrink-0 text-pool" aria-hidden />
              ) : (
                <XIcon className="h-4 w-4 shrink-0 text-contour" aria-hidden />
              )}
              <span className="min-w-0">
                {item.label}
                {item.value && (
                  <span className="font-mono ml-2 text-xs uppercase tracking-wide text-ink/75">
                    {item.value}
                  </span>
                )}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              {showBadge(item) && (
                <ProvenanceBadge
                  source={item.source}
                  confidence={item.confidence}
                  detail={item.detail}
                />
              )}
              {gymId && factType && item.present && (
                <FactConfirm
                  gymId={gymId}
                  factType={factType}
                  factKey={item.key}
                  confirms={confirmCounts?.[item.key] ?? 0}
                />
              )}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
