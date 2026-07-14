"use client";

import {
  BadgeCheck,
  Building2,
  CircleHelp,
  Database,
  Globe,
  Landmark,
  Map as MapIcon,
  Users,
} from "lucide-react";
import { PROVENANCE_META, type ProvenanceSource } from "@/lib/types/scout";
import { InfoPopover } from "@/components/ui/InfoPopover";

const ICONS: Record<ProvenanceSource, React.ComponentType<{ className?: string }>> = {
  scout_verified: BadgeCheck,
  owner: Building2,
  user: Users,
  scraped: Globe,
  seed: Database,
  osm: MapIcon,
  city_data: Landmark,
  estimated: CircleHelp,
};

const TONES: Record<ProvenanceSource, string> = {
  scout_verified: "text-pool-deep bg-pool-tint",
  owner: "text-pool-deep bg-pool-tint",
  user: "text-ink/70 bg-paper",
  scraped: "text-ink/70 bg-paper",
  seed: "text-ink/70 bg-paper",
  osm: "text-ink/70 bg-paper",
  city_data: "text-ink/70 bg-paper",
  estimated: "text-ink/65 bg-paper",
};

/**
 * Every fact in Scout carries its source + confidence — shown, not hidden.
 * This is the data-honesty surface of the provenance model: tap/click/Enter
 * opens a small note (keeps the `title` tooltip for pointer users too), so
 * the meaning isn't locked behind hover-only affordance.
 */
export function ProvenanceBadge({
  source,
  confidence,
  detail,
}: {
  source: ProvenanceSource;
  confidence: number;
  detail?: string | null;
}) {
  const Icon = ICONS[source];
  const meta = PROVENANCE_META[source];
  const showConfidence =
    source !== "scout_verified" && source !== "owner" && confidence < 0.85;
  const summary = `Source: ${meta.label}${showConfidence ? ` · confidence ${Math.round(confidence * 100)}%` : ""}`;

  return (
    <InfoPopover
      trigger={
        <>
          <Icon className="h-3 w-3" aria-hidden />
          {meta.label}
          {showConfidence && <span className="opacity-60">{Math.round(confidence * 100)}%</span>}
        </>
      }
      triggerClassName={`readout inline-flex items-center gap-1 rounded border border-paper-line px-1.5 py-0.5 ${TONES[source]}`}
      triggerStyle={{ fontSize: 9.5 }}
      title={detail ?? summary}
      note={
        <>
          <p className="font-semibold text-ink">{meta.label}</p>
          {showConfidence && (
            <p className="mt-0.5 text-ink/70">Confidence: {Math.round(confidence * 100)}%</p>
          )}
          {detail && <p className="mt-1 text-ink/80">{detail}</p>}
        </>
      }
    />
  );
}
