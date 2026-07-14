"use client";

import Link from "next/link";
import { MapPin, X } from "lucide-react";
import { SEGMENT_LABELS, type ScoredGym } from "@/lib/types/scout";
import { deriveAccessStatus } from "@/lib/access";
import { MatchBadge } from "./MatchBadge";
import { AccessBadge } from "./AccessBadge";

/** Compact gym row for drawers and trip cards. */
export function GymRow({
  gym,
  onRemove,
  extraMeta,
}: {
  gym: ScoredGym;
  onRemove?: (id: string) => void;
  /** Trailing readout item, e.g. "~12 min drive" on trip cards. */
  extraMeta?: string;
}) {
  const topAmenities = gym.amenities.filter((a) => a.present).slice(0, 3);
  const access = deriveAccessStatus(gym);
  return (
    <div className="flex items-center gap-3 rounded-lg border border-paper-line bg-paper-raise p-3 transition-colors hover:border-ink/30">
      <Link href={`/gym/${gym.slug}`} className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="display truncate text-[14px] tracking-wide text-ink">
            {gym.name}
          </span>
          {gym.matchScore !== null && (
            <MatchBadge
              score={gym.matchScore}
              reasons={gym.matchReasons}
              missingItems={gym.missingItems}
              size="sm"
            />
          )}
        </div>
        <div className="readout mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-ink/70">
          <MapPin className="h-3 w-3" aria-hidden />
          {gym.neighborhood ?? "—"}
          {gym.segment && (
            <>
              <span className="opacity-40">·</span> {SEGMENT_LABELS[gym.segment]}
            </>
          )}
          <span className="opacity-40">·</span>
          {access.derivable ? (
            <AccessBadge gym={gym} context="card" />
          ) : (
            <span className="text-ink/45">Day pass unlisted</span>
          )}
          {extraMeta && (
            <>
              <span className="opacity-40">·</span>
              <span className="font-semibold text-pool-deep">{extraMeta}</span>
            </>
          )}
        </div>
        {topAmenities.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1">
            {topAmenities.map((a) => (
              <span
                key={a.amenity_key}
                className="font-mono rounded border border-paper-line bg-paper px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-ink/75"
              >
                {a.amenity_key.replace(/_/g, " ")}
              </span>
            ))}
          </div>
        )}
      </Link>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(gym.id)}
          aria-label={`Remove ${gym.name}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-paper-line text-ink/65 transition-colors hover:border-blaze hover:text-blaze"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
