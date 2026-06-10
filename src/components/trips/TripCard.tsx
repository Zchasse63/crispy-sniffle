"use client";

import { useEffect, useMemo, useState } from "react";
import { BedDouble, CalendarRange, Trash2, X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchCityGyms } from "@/lib/queries/gyms";
import { scoreGyms } from "@/lib/scoring/scorer";
import { isEmptyFilterSet, type City, type EnrichedGym, type Trip } from "@/lib/types/scout";
import { fetchTravelMinutes, geocodeLodging } from "@/lib/travel";
import { useFilterStore } from "@/stores/filterStore";
import { useShortlistStore } from "@/stores/shortlistStore";
import { useTripStore } from "@/stores/tripStore";
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
  const setLodging = useTripStore((s) => s.setLodging);
  const [city, setCity] = useState<City | null>(null);
  const [gyms, setGyms] = useState<EnrichedGym[] | null>(null);
  const [lodgingInput, setLodgingInput] = useState("");
  const [lodgingBusy, setLodgingBusy] = useState(false);
  const [lodgingNote, setLodgingNote] = useState<string | null>(null);
  const [driveMins, setDriveMins] = useState<Map<string, number>>(new Map());

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

  // drive times from lodging to every destination gym (Matrix API)
  useEffect(() => {
    if (!trip.lodging || !gyms || gyms.length === 0) {
      setDriveMins(new Map());
      return;
    }
    let cancelled = false;
    fetchTravelMinutes(
      trip.lodging,
      gyms
        .filter((g) => g.lat !== null && g.lng !== null)
        .map((g) => ({ id: g.id, lng: g.lng as number, lat: g.lat as number })),
    ).then((m) => {
      if (!cancelled) setDriveMins(m);
    });
    return () => {
      cancelled = true;
    };
  }, [trip.lodging, gyms]);

  const matched = useMemo(() => {
    if (!gyms) return null;
    const scored = scoreGyms(gyms, filters);
    if (driveMins.size === 0) return scored.slice(0, 4);
    // blend: best 8 by fit, surfaced in drive-time order
    return scored
      .slice(0, 8)
      .sort((a, b) => (driveMins.get(a.id) ?? 9e9) - (driveMins.get(b.id) ?? 9e9))
      .slice(0, 4);
  }, [gyms, filters, driveMins]);

  const submitLodging = async () => {
    if (lodgingBusy) return;
    setLodgingBusy(true);
    setLodgingNote(null);
    const cityCenter =
      gyms && gyms.length > 0 && gyms[0].lat !== null && gyms[0].lng !== null
        ? { lng: gyms[0].lng, lat: gyms[0].lat }
        : undefined;
    const found = await geocodeLodging(`${lodgingInput}, ${trip.cityName}`, cityCenter);
    setLodgingBusy(false);
    if (!found) {
      setLodgingNote("Couldn't place that address — try adding a street or area.");
      return;
    }
    setLodging(trip.id, found);
    setLodgingInput("");
  };

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

      {/* lodging → drive-time ranking */}
      <div className="mt-4 rounded-lg border border-paper-line bg-paper px-3 py-2.5">
        {trip.lodging ? (
          <div className="flex items-start justify-between gap-2">
            <p className="readout flex min-w-0 items-center gap-1.5 text-ink/80">
              <BedDouble className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate normal-case tracking-normal">
                {trip.lodging.label}
              </span>
            </p>
            <button
              type="button"
              onClick={() => setLodging(trip.id, null)}
              aria-label="Clear lodging"
              className="text-ink/60 transition-colors hover:text-blaze"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submitLodging();
            }}
            className="flex items-center gap-2"
          >
            <BedDouble className="h-3.5 w-3.5 shrink-0 text-ink/60" aria-hidden />
            <input
              value={lodgingInput}
              onChange={(e) => setLodgingInput(e.target.value)}
              placeholder="Where are you staying? (hotel, address…)"
              aria-label={`Lodging for your ${trip.cityName} trip`}
              className="min-w-0 flex-1 bg-transparent text-xs text-ink outline-none placeholder:text-ink/45"
            />
            <button
              type="submit"
              disabled={lodgingBusy || lodgingInput.trim().length < 3}
              className="font-mono rounded border border-paper-line px-2 py-1 text-[10px] uppercase tracking-wide text-ink/75 transition-colors hover:border-ink/40 hover:text-ink disabled:opacity-50"
            >
              {lodgingBusy ? "…" : "Set"}
            </button>
          </form>
        )}
        {lodgingNote && <p className="mt-1.5 text-[11px] text-ink/65">{lodgingNote}</p>}
      </div>

      <p className="readout mt-4 text-ink/70">
        {trip.lodging
          ? "Closest fits to where you're staying"
          : usingPrefs
            ? "Matched to your current filters"
            : "Scout's picks at your destination"}
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
          matched.map((g) => {
            const mins = driveMins.get(g.id);
            return (
              <GymRow
                key={g.id}
                gym={g}
                extraMeta={mins !== undefined ? `~${mins} min drive` : undefined}
              />
            );
          })
        )}
      </div>
    </article>
  );
}
