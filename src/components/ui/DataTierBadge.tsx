"use client";

import { ShieldCheck, CircleDashed } from "lucide-react";
import { InfoPopover } from "./InfoPopover";

/** Honest data-tier labeling: rich = full Scout dataset, basic = limited.
 *  Tap/click/Enter opens a small note (keeps the `title` tooltip for
 *  pointer users too), so the meaning isn't locked behind hover-only. */
export function DataTierBadge({ tier }: { tier: "rich" | "basic" }) {
  if (tier === "rich") {
    return (
      <InfoPopover
        trigger={
          <>
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Scout data
          </>
        }
        triggerClassName="readout inline-flex items-center gap-1.5 rounded-full bg-pool-tint px-2.5 py-1 text-pool-deep"
        title="Scout has detailed, curated data for this city"
        note="Scout has detailed, curated data for this city — hours, pricing, equipment and amenities are verified or carefully researched."
      />
    );
  }
  return (
    <InfoPopover
      trigger={
        <>
          <CircleDashed className="h-3.5 w-3.5" aria-hidden /> Limited data
        </>
      }
      triggerClassName="readout inline-flex items-center gap-1.5 rounded-full border border-contour bg-paper px-2.5 py-1 text-ink/70"
      title="Scout hasn't fully mapped this city yet — listings are limited"
      note="Scout hasn't fully mapped this city yet — listings are limited and lightly detailed until this city gets the full treatment."
    />
  );
}
