"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchGymsByIds } from "@/lib/queries/gyms";
import type { EnrichedGym } from "@/lib/types/scout";
import { useShortlistStore } from "@/stores/shortlistStore";
import { CompareTable } from "@/components/compare/CompareTable";
import { EmptyState } from "@/components/ui/EmptyState";

export default function ComparePage() {
  const router = useRouter();
  const savedIds = useShortlistStore((s) => s.savedIds);
  const remove = useShortlistStore((s) => s.remove);
  const [gyms, setGyms] = useState<EnrichedGym[] | null>(null);

  const compareIds = savedIds.slice(0, 3);

  useEffect(() => {
    if (compareIds.length < 2) {
      setGyms([]);
      return;
    }
    let cancelled = false;
    fetchGymsByIds(getBrowserClient(), compareIds).then((g) => {
      if (!cancelled) setGyms(g);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedIds.join(",")]);

  return (
    <div className="survey-grid mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <p className="readout text-pool">Side-by-side</p>
      <h1 className="display mt-1 text-3xl text-ink sm:text-4xl">Compare</h1>
      <p className="mt-2 text-sm text-ink/65">
        Your first three shortlisted gyms, attribute by attribute.
        {savedIds.length > 3 && " (Remove one to compare another.)"}
      </p>

      <div className="mt-6">
        {compareIds.length < 2 ? (
          <EmptyState
            title="Not enough to compare"
            description="Save at least two gyms from Explore and they'll line up here, attribute by attribute."
            action={{ label: "Find gyms", onClick: () => router.push("/") }}
          />
        ) : gyms === null ? (
          <div className="skeleton h-96 w-full rounded-xl" />
        ) : (
          <CompareTable gyms={gyms} onRemove={remove} />
        )}
      </div>
    </div>
  );
}
