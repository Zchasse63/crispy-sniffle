import {
  BadgeCheck,
  Building2,
  CircleHelp,
  Database,
  Globe,
  Users,
} from "lucide-react";
import { PROVENANCE_META, type ProvenanceSource } from "@/lib/types/scout";

const ICONS: Record<ProvenanceSource, React.ComponentType<{ className?: string }>> = {
  scout_verified: BadgeCheck,
  owner: Building2,
  user: Users,
  scraped: Globe,
  seed: Database,
  estimated: CircleHelp,
};

const TONES: Record<ProvenanceSource, string> = {
  scout_verified: "text-pool-deep bg-pool-tint",
  owner: "text-pool-deep bg-pool-tint",
  user: "text-ink/70 bg-paper",
  scraped: "text-ink/70 bg-paper",
  seed: "text-ink/70 bg-paper",
  estimated: "text-ink/65 bg-paper",
};

/**
 * Every fact in Scout carries its source + confidence — shown, not hidden.
 * This is the data-honesty surface of the provenance model.
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
  return (
    <span
      title={detail ?? `Source: ${meta.label}${showConfidence ? ` · confidence ${Math.round(confidence * 100)}%` : ""}`}
      className={`readout inline-flex items-center gap-1 rounded border border-paper-line px-1.5 py-0.5 ${TONES[source]}`}
      style={{ fontSize: 9.5 }}
    >
      <Icon className="h-3 w-3" aria-hidden />
      {meta.label}
      {showConfidence && (
        <span className="opacity-60">{Math.round(confidence * 100)}%</span>
      )}
    </span>
  );
}
