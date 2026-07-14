"use client";

import { useMemo } from "react";
import { Check, Minus } from "lucide-react";
import { isEmptyFilterSet, type EnrichedGym } from "@/lib/types/scout";
import { scoreGyms } from "@/lib/scoring/scorer";
import { useFilterStore } from "@/stores/filterStore";
import { MatchBadge } from "./MatchBadge";

/**
 * Carries the "N match · why it fits" story that earned the click on search
 * results through onto the gym detail page. Scoring is delegated entirely to
 * the shared deterministic scorer (lib/scoring/scorer.ts) — no local scoring
 * logic here, matching the one-scorer-implementation rule.
 *
 * filterStore is session-only by design (no persist/skipHydration — see
 * stores/filterStore.ts). SSR and the first client render both start from
 * EMPTY_FILTER_SET, so a direct visit with no active search correctly
 * renders nothing and there's no SSR/CSR mismatch to flash. Follows the same
 * direct-read pattern as DiscoveryClient/ShortlistButton (no extra hydration
 * gating needed for this store).
 */
export function MatchContext({ gym }: { gym: EnrichedGym }) {
  const filters = useFilterStore((s) => s.filters);

  const scored = useMemo(() => {
    if (isEmptyFilterSet(filters)) return null;
    return scoreGyms([gym], filters, new Date())[0] ?? null;
  }, [gym, filters]);

  if (!scored || scored.matchScore === null) return null;

  return (
    <div className="mt-5 rounded-lg border border-ink-line bg-ink-raise/70 px-4 py-3.5">
      <MatchBadge
        score={scored.matchScore}
        reasons={scored.matchReasons}
        missingItems={scored.missingItems}
      />
      {scored.matchReasons.length > 0 && (
        <div className="mt-2.5 border-t border-ink-line pt-2.5 text-xs leading-relaxed text-mist">
          <span className="inline-flex items-start gap-1.5">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blaze" aria-hidden />
            <span>
              <b className="font-semibold text-paper">Why it fits:</b>{" "}
              {scored.matchReasons.slice(0, 3).join(" · ")}
              {scored.missingItems.length > 0 && (
                <span className="mt-0.5 flex items-start gap-1.5 text-mist/80">
                  <Minus className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  {scored.missingItems[0]}
                </span>
              )}
            </span>
          </span>
        </div>
      )}
    </div>
  );
}
