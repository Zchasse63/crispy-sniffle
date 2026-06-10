"use client";

import Link from "next/link";
import { MapPin, X } from "lucide-react";
import type { ScoredGym } from "@/lib/types/scout";
import { MatchBadge } from "./MatchBadge";

/** Compact gym row for drawers and trip cards. */
export function GymRow({
  gym,
  onRemove,
}: {
  gym: ScoredGym;
  onRemove?: (id: string) => void;
}) {
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
        <div className="readout mt-1 flex items-center gap-1.5 text-ink/55">
          <MapPin className="h-3 w-3" aria-hidden />
          {gym.neighborhood ?? "—"}
          {gym.day_pass_price !== null && (
            <>
              <span className="opacity-40">·</span> $
              {Number(gym.day_pass_price).toFixed(0)} day
            </>
          )}
        </div>
      </Link>
      {onRemove && (
        <button
          type="button"
          onClick={() => onRemove(gym.id)}
          aria-label={`Remove ${gym.name}`}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-paper-line text-ink/50 transition-colors hover:border-blaze hover:text-blaze"
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
