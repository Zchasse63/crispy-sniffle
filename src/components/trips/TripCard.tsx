"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Trash2 } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchCityGyms } from "@/lib/queries/gyms";
import { scoreGyms } from "@/lib/scoring/scorer";
import { isEmptyFilterSet, type City, type EnrichedGym, type Trip } from "@/lib/types/scout";
import { useFilterStore } from "@/stores/filterStore";
import { useShortlistStore } from "@/stores/shortlistStore";
import { DataTierBadge } from "@/components/ui/DataTierBadge";
import { GymRow } from "@/components/gym/GymRow";

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const showYear = y !== new Date().getFullYear();
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(showYear ? { year: "numeric" } : {}),
  });
}

export function TripCard({ trip, onRemove }: { trip: Trip; onRemove: (id: string) => void }) {
  const filters = useFilterStore((s) => s.filters);
  const [city, setCity] = useState<City | null>(null);
  const [gyms, setGyms] = useState<EnrichedGym[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCityGyms(getBrowserClient(), trip.citySlug).then(({ city, gyms }) => {
      if (cancelled) return;
      setCity(city);
      setGyms(gyms);
    });
    return () => {
      cancelled = true;
    };
  }, [trip.citySlug]);

  const matched = useMemo(() => {
    if (!gyms) return null;
    return scoreGyms(gyms, filters).slice(0, 4);
  }, [gyms, filters]);

  const usingPrefs = !isEmptyFilterSet(filters);
  const savedIds = useShortlistStore((s) => s.savedIds);
  const savedHere = useMemo(
    () => (gyms ? gyms.filter((g) => savedIds.includes(g.id)).length : 0),
    [gyms, savedIds],
  );

  return (
    <article className="rounded-xl border border-paper-line bg-paper-raise p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="display text-2xl text-ink">{trip.cityName}</h2>
          <p className="readout mt-1.5 flex items-center gap-1.5 text-ink/70">
            <CalendarRange className="h-3.5 w-3.5" aria-hidden />
            {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {city && <DataTierBadge tier={city.tier} />}
          <button
            type="button"
            onClick={() => onRemove(trip.id)}
            aria-label={`Remove trip to ${trip.cityName}`}
            className="flex h-8 w-8 items-center justify-center rounded-md border border-paper-line text-ink/65 transition-colors hover:border-blaze hover:text-blaze"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      </div>

      {city?.tier === "basic" && (
        <p className="mt-3 rounded-lg border border-dashed border-contour bg-paper px-3 py-2 text-xs leading-relaxed text-ink/65">
          Scout hasn&apos;t fully mapped {city.name} yet — listings are limited and
          lightly detailed until this city gets the full treatment.
        </p>
      )}

      {savedHere > 0 && (
        <p className="mt-3 text-xs font-semibold text-pool-deep">
          ★ {savedHere} of your saved {savedHere === 1 ? "gym is" : "gyms are"} in this city
        </p>
      )}

      <p className="readout mt-4 text-ink/70">
        {usingPrefs ? "Matched to your current filters" : "Scout's picks at your destination"}
      </p>
      <div className="mt-2 space-y-2">
        {matched === null ? (
          <>
            <div className="skeleton h-16 w-full rounded-lg" />
            <div className="skeleton h-16 w-full rounded-lg" />
          </>
        ) : matched.length === 0 ? (
          <p className="py-4 text-sm text-ink/70">
            No gyms on file for this destination yet.
          </p>
        ) : (
          matched.map((g) => <GymRow key={g.id} gym={g} />)
        )}
      </div>
    </article>
  );
}
