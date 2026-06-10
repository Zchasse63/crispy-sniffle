import { ShieldCheck, CircleDashed } from "lucide-react";

/** Honest data-tier labeling: rich = full Scout dataset, basic = limited. */
export function DataTierBadge({ tier }: { tier: "rich" | "basic" }) {
  if (tier === "rich") {
    return (
      <span
        className="readout inline-flex items-center gap-1.5 rounded-full bg-pool-tint px-2.5 py-1 text-pool-deep"
        title="Scout has detailed, curated data for this city"
      >
        <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Scout data
      </span>
    );
  }
  return (
    <span
      className="readout inline-flex items-center gap-1.5 rounded-full border border-contour bg-paper px-2.5 py-1 text-ink/60"
      title="Scout hasn't fully mapped this city yet — listings are limited"
    >
      <CircleDashed className="h-3.5 w-3.5" aria-hidden /> Limited data
    </span>
  );
}
