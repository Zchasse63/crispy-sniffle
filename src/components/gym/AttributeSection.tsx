import { BadgeCheck, Check, X as XIcon } from "lucide-react";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { FactConfirm } from "@/components/community/FactConfirm";
import { AttributeOverflowTrigger } from "./AttributeOverflowTrigger";
import { MACHINE_KEYS, PROVENANCE_META } from "@/lib/types/scout";
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
export const showBadge = (item: AttributeItem) =>
  item.source !== "seed" || item.confidence < 0.7;

/** When ≥80% of a section's badged rows share one source, that source is the
 *  section's story — say it once in the header and only badge the exceptions
 *  (estimated rows always stay badged: honesty beats tidiness). */
export function dominantSource(items: AttributeItem[]): AttributeItem["source"] | null {
  const badged = items.filter(showBadge);
  if (badged.length < 4) return null;
  const tally = new Map<AttributeItem["source"], number>();
  for (const i of badged) tally.set(i.source, (tally.get(i.source) ?? 0) + 1);
  const [top, n] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  return top !== "estimated" && n / badged.length >= 0.8 ? top : null;
}

/** Single fact row — present/absent icon, value, provenance badge, community
 *  confirm controls. Extracted so AttributeSection's collapsed view and
 *  AttributeOverflowModal's complete view render identically; never fork
 *  this markup. */
export function AttributeRow({
  item,
  dominant,
  gymId,
  factType,
  confirmCounts,
}: {
  item: AttributeItem;
  dominant: AttributeItem["source"] | null;
  gymId?: string;
  factType?: "amenity" | "equipment";
  confirmCounts?: Record<string, number>;
}) {
  return (
    <li
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
        {((showBadge(item) && item.source !== dominant) ||
          // low confidence is information the dominant summary must
          // never swallow — those rows stay individually badged
          (item.confidence < 0.7 && item.source !== "seed")) && (
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
  );
}

/** Selects which rows show in the collapsed view: present facts first
 *  (highest-confidence first within that group), then — only if there
 *  aren't enough present rows to fill `count` — absent/unknown rows in
 *  their original order. Never reorders beyond that; the full list (shown
 *  via "Show all") keeps its original order untouched. */
function visibleSlice(items: AttributeItem[], count: number): AttributeItem[] {
  const present = items.filter((i) => i.present);
  const absent = items.filter((i) => !i.present);
  const presentByConfidence = [...present].sort((a, b) => b.confidence - a.confidence);
  if (presentByConfidence.length >= count) return presentByConfidence.slice(0, count);
  return [...presentByConfidence, ...absent.slice(0, count - presentByConfidence.length)];
}

/** Grouped facts with visible provenance — Scout never hides where data came from. */
export function AttributeSection({
  title,
  items,
  gymId,
  factType,
  confirmCounts,
  gymName,
  collapsedCount = 8,
}: {
  title: string;
  items: AttributeItem[];
  /** When provided, rows gain community confirm/correct controls. */
  gymId?: string;
  factType?: "amenity" | "equipment";
  confirmCounts?: Record<string, number>;
  /** Used in the overflow modal's title ("All {title} — {gymName}"); the
   *  section renders fine without it (falls back to "All {title}"). */
  gymName?: string;
  /** Collapse to this many rows + a "Show all N" disclosure once the
   *  section has more than collapsedCount + 2 items — never hides just
   *  1-2 rows. */
  collapsedCount?: number;
}) {
  if (items.length === 0) return null;
  const allCurated = items.every((i) => !showBadge(i));
  const dominant = dominantSource(items);
  const collapsed = items.length > collapsedCount + 2;
  const visibleItems = collapsed ? visibleSlice(items, collapsedCount) : items;
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
        {dominant && (
          <span
            className="readout inline-flex items-center gap-1 text-ink/55"
            title={`Most facts in this section: ${PROVENANCE_META[dominant].label} — only exceptions are badged below`}
          >
            <BadgeCheck className="h-3.5 w-3.5" aria-hidden /> Mostly{" "}
            {PROVENANCE_META[dominant].label.toLowerCase()}
          </span>
        )}
      </div>
      <ul className="mt-3 divide-y divide-paper-line/60">
        {visibleItems.map((item) => (
          <AttributeRow
            key={item.key}
            item={item}
            dominant={dominant}
            gymId={gymId}
            factType={factType}
            confirmCounts={confirmCounts}
          />
        ))}
      </ul>
      {collapsed && (
        <AttributeOverflowTrigger
          title={title}
          items={items}
          gymId={gymId}
          factType={factType}
          confirmCounts={confirmCounts}
          gymName={gymName}
        />
      )}
    </section>
  );
}
