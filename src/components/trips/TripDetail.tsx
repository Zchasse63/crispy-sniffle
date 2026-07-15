"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, BedDouble, CalendarRange, Plus, X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchCityGyms, fetchGymsByIds } from "@/lib/queries/gyms";
import { scoreGyms, openDuringStay, type StayOpenTally } from "@/lib/scoring/scorer";
import {
  isEmptyFilterSet,
  type City,
  type EnrichedGym,
  type ScoredGym,
  type Trip,
} from "@/lib/types/scout";
import { fetchTravelMinutes, geocodeLodging } from "@/lib/travel";
import { walkMinutes, parkingHeadline } from "@/lib/parking";
import { openStatus } from "@/lib/hours";
import { useFilterStore } from "@/stores/filterStore";
import { useTripStore } from "@/stores/tripStore";
import { DataTierBadge } from "@/components/ui/DataTierBadge";
import { GymRow } from "@/components/gym/GymRow";
import { EmptyState } from "@/components/ui/EmptyState";
import { toast } from "@/components/ui/Toast";

/** Wrap a plain EnrichedGym as an unscored ScoredGym for GymRow — same idiom
 *  ShortlistDrawer/ProfilePortal already use (matchScore null → GymRow just
 *  omits the MatchBadge). */
function asScored(g: EnrichedGym): ScoredGym {
  return { ...g, matchScore: null, matchReasons: [], missingItems: [] };
}

/** Same short-date formatting as TripCard's local fmtDate — duplicated
 *  rather than extracted so this route stays inside its assigned file set. */
function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const showYear = y !== new Date().getFullYear();
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(showYear ? { year: "numeric" } : {}),
  });
}

/** Resolve a trip by id first, falling back to the (citySlug, startDate,
 *  endDate) tuple carried in the URL's `c`/`s`/`e` search params — the
 *  fallback survives the known trap where sign-in merge swaps a trip's local
 *  crypto.randomUUID() id for the cloud row's id (src/lib/merge.ts). */
function resolveTrip(
  trips: Trip[],
  params: { id: string; citySlug: string | null; startDate: string | null; endDate: string | null },
): Trip | null {
  const byId = trips.find((t) => t.id === params.id);
  if (byId) return byId;
  if (!params.citySlug || !params.startDate || !params.endDate) return null;
  return (
    trips.find(
      (t) =>
        t.citySlug === params.citySlug &&
        t.startDate === params.startDate &&
        t.endDate === params.endDate,
    ) ?? null
  );
}

/** Inclusive calendar-day count between two YYYY-MM-DD dates, parsed as
 *  local dates (never `new Date(isoString)`, which reads as UTC midnight and
 *  can shift the day in negative-UTC-offset zones). Mirrors the same local-
 *  date-construction idiom `openDuringStay` uses internally. */
function inclusiveDayCount(startDate: string, endDate: string): number {
  const [sy, sm, sd] = startDate.split("-").map(Number);
  const [ey, em, ed] = endDate.split("-").map(Number);
  const start = new Date(sy, sm - 1, sd);
  const end = new Date(ey, em - 1, ed);
  let days = 0;
  const cursor = new Date(start);
  while (cursor.getTime() <= end.getTime()) {
    days += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

type StayClass = "all_open" | "unlisted" | "some_closed";

/** `closedDays > 0` wins the bucket even if another day in the same window is
 *  ALSO unknown — a confirmed closed day is the more decision-relevant fact.
 *  Only a stay with zero closed days and no indeterminate days counts as
 *  fully open. */
function classifyStay(tally: StayOpenTally): StayClass {
  if (tally.closedDays > 0) return "some_closed";
  if (tally.unknown) return "unlisted";
  return "all_open";
}

const STAY_RANK: Record<StayClass, number> = { all_open: 0, unlisted: 1, some_closed: 2 };

/** Honest per-gym line: "Open all N days of your stay" / "Closed N of M days
 *  (typical hours)" / "Hours unlisted" — never a fabricated in-between. */
function stayLabel(tally: StayOpenTally, startDate: string, endDate: string): string {
  const cls = classifyStay(tally);
  if (cls === "unlisted") return "Hours unlisted";
  const total = inclusiveDayCount(startDate, endDate);
  if (cls === "some_closed") return `Closed ${tally.closedDays} of ${total} days (typical hours)`;
  return `Open all ${total} days of your stay`;
}

/** Post-score re-rank NUDGE for the picks list only — never a hard filter.
 *  Open-every-day-of-stay sorts above partially-closed; unknown hours stay
 *  NEUTRAL in the middle (never penalized below a confirmed closed day).
 *  `Array#sort` is spec-stable, so gyms tied on stay rank keep the fit/drive
 *  order they arrived in. */
function rankByStay(gyms: ScoredGym[], startDate: string, endDate: string): ScoredGym[] {
  return [...gyms].sort((a, b) => {
    const ra = STAY_RANK[classifyStay(openDuringStay(a.hours, startDate, endDate))];
    const rb = STAY_RANK[classifyStay(openDuringStay(b.hours, startDate, endDate))];
    return ra - rb;
  });
}

/** At-the-door logistics for a gym already on the trip: primary parking
 *  headline + walk time (from GymParkingRecord, same fields ParkingCard's
 *  parkingSummary reads), then current open/closed status — falling back to
 *  the honest "Hours unlisted" rather than omitting the fact silently. */
function atTheDoorLine(gym: EnrichedGym, now: Date): string {
  const primaryParking = gym.parking.find((p) => p.is_primary) ?? gym.parking[0] ?? null;
  const bits: string[] = [];
  if (primaryParking) {
    bits.push(parkingHeadline(primaryParking));
    if (primaryParking.distance_m !== null) bits.push(walkMinutes(primaryParking.distance_m));
  }
  const status = openStatus(gym.hours, now);
  bits.push(status ? status.label : "Hours unlisted");
  return bits.join(" · ");
}

export function TripDetail({
  id,
  citySlug,
  startDate,
  endDate,
}: {
  id: string;
  citySlug: string | null;
  startDate: string | null;
  endDate: string | null;
}) {
  const router = useRouter();
  const trips = useTripStore((s) => s.trips);
  const setLodging = useTripStore((s) => s.setLodging);
  const addGymToTrip = useTripStore((s) => s.addGymToTrip);
  const removeGymFromTrip = useTripStore((s) => s.removeGymFromTrip);
  const filters = useFilterStore((s) => s.filters);

  // Lazy-init reads hydration state synchronously at mount (already true for
  // every navigation after the root HydrationGate's rehydrate() resolves);
  // the effect only needs to SUBSCRIBE for the rare case a direct load reaches
  // this component before that resolves — it must not call setState itself
  // when already hydrated (react-hooks/set-state-in-effect).
  const [hydrated, setHydrated] = useState(() => useTripStore.persist.hasHydrated());
  useEffect(() => {
    if (hydrated) return;
    return useTripStore.persist.onFinishHydration(() => setHydrated(true));
  }, [hydrated]);

  const trip = useMemo(
    () => resolveTrip(trips, { id, citySlug, startDate, endDate }),
    [trips, id, citySlug, startDate, endDate],
  );

  // Self-heal a stale bookmarked/shared id once the tuple fallback resolves
  // a different (current, post-merge) id — keeps future visits on the fast
  // id-hit path instead of the tuple fallback every time.
  useEffect(() => {
    if (trip && trip.id !== id && citySlug && startDate && endDate) {
      router.replace(
        `/trips/${trip.id}?c=${encodeURIComponent(citySlug)}&s=${startDate}&e=${endDate}`,
      );
    }
  }, [trip, id, citySlug, startDate, endDate, router]);

  const tripId = trip?.id ?? null;
  const tripCitySlug = trip?.citySlug ?? null;
  const tripStartDate = trip?.startDate ?? null;
  const tripEndDate = trip?.endDate ?? null;
  const gymIdsKey = trip?.gymIds.join(",") ?? "";

  const [city, setCity] = useState<City | null>(null);
  const [cityGyms, setCityGyms] = useState<EnrichedGym[] | null>(null);
  useEffect(() => {
    if (!tripCitySlug) return;
    let cancelled = false;
    fetchCityGyms(getBrowserClient(), tripCitySlug).then(({ city, gyms }) => {
      if (cancelled) return;
      setCity(city);
      setCityGyms(gyms);
    });
    return () => {
      cancelled = true;
    };
  }, [tripCitySlug]);

  const [tripGyms, setTripGyms] = useState<EnrichedGym[] | null>(null);
  useEffect(() => {
    if (!tripId) return;
    let cancelled = false;
    const ids = gymIdsKey ? gymIdsKey.split(",") : [];
    fetchGymsByIds(getBrowserClient(), ids).then((gyms) => {
      if (!cancelled) setTripGyms(gyms);
    });
    return () => {
      cancelled = true;
    };
  }, [tripId, gymIdsKey]);

  // lodging → drive-time ranking, same mechanics as TripCard (geocodeLodging
  // + fetchTravelMinutes), extended to cover both the trip's own gyms and
  // the destination candidate pool.
  const [lodgingInput, setLodgingInput] = useState("");
  const [lodgingBusy, setLodgingBusy] = useState(false);
  const [lodgingNote, setLodgingNote] = useState<string | null>(null);
  const [driveMins, setDriveMins] = useState<Map<string, number>>(new Map());

  const lodging = trip?.lodging ?? null;
  const lodgingKey = lodging ? `${lodging.lng},${lodging.lat}` : null;
  useEffect(() => {
    const allGyms = [...(cityGyms ?? []), ...(tripGyms ?? [])];
    const byId = new Map(allGyms.map((g) => [g.id, g]));
    if (!lodging || byId.size === 0) {
      const raf = requestAnimationFrame(() => setDriveMins(new Map()));
      return () => cancelAnimationFrame(raf);
    }
    let cancelled = false;
    fetchTravelMinutes(
      lodging,
      [...byId.values()]
        .filter((g) => g.lat !== null && g.lng !== null)
        .map((g) => ({ id: g.id, lng: g.lng as number, lat: g.lat as number })),
    ).then((m) => {
      if (!cancelled) setDriveMins(m);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lodgingKey, cityGyms, tripGyms]);

  const submitLodging = async () => {
    if (lodgingBusy || !tripId) return;
    setLodgingBusy(true);
    setLodgingNote(null);
    const cityCenter =
      cityGyms && cityGyms.length > 0 && cityGyms[0].lat !== null && cityGyms[0].lng !== null
        ? { lng: cityGyms[0].lng, lat: cityGyms[0].lat }
        : undefined;
    const found = await geocodeLodging(`${lodgingInput}, ${trip?.cityName ?? ""}`, cityCenter);
    setLodgingBusy(false);
    if (!found) {
      setLodgingNote("Couldn't place that address — try adding a street or area.");
      return;
    }
    setLodging(tripId, found);
    setLodgingInput("");
  };

  const now = useMemo(() => new Date(), []);

  const picks = useMemo(() => {
    if (!cityGyms || !tripId || !tripStartDate || !tripEndDate) return null;
    const tripIdSet = new Set(trip?.gymIds ?? []);
    const candidates = cityGyms.filter((g) => !tripIdSet.has(g.id));
    const scored = scoreGyms(candidates, filters);
    const blended =
      driveMins.size === 0
        ? scored.slice(0, 8)
        : scored
            .slice(0, 16)
            .sort((a, b) => (driveMins.get(a.id) ?? 9e9) - (driveMins.get(b.id) ?? 9e9))
            .slice(0, 8);
    return rankByStay(blended, tripStartDate, tripEndDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityGyms, gymIdsKey, filters, driveMins, tripId, tripStartDate, tripEndDate]);

  const handleRemoveFromTrip = (gymId: string) => {
    if (!tripId) return;
    removeGymFromTrip(tripId, gymId);
    toast("Removed from trip", { onUndo: () => useTripStore.getState().addGymToTrip(tripId, gymId) });
  };

  const handleAddToTrip = (gymId: string) => {
    if (!tripId) return;
    addGymToTrip(tripId, gymId);
    toast("Added to trip");
  };

  if (!hydrated) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="survey-grid mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6"
      >
        <div className="skeleton h-24 w-full rounded-xl" />
      </main>
    );
  }

  if (!trip) {
    return (
      <main
        id="main-content"
        tabIndex={-1}
        className="survey-grid mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6"
      >
        <EmptyState
          title="Trip not found"
          description="This trip may have been removed, or the link is out of date."
          action={{ label: "Back to trips", onClick: () => router.push("/trips") }}
        />
      </main>
    );
  }

  const usingPrefs = !isEmptyFilterSet(filters);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="survey-grid mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6"
    >
      <Link
        href="/trips"
        className="readout inline-flex items-center gap-1.5 text-ink/65 transition-colors hover:text-ink"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Back to trips
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="display text-3xl text-ink sm:text-4xl">{trip.cityName}</h1>
          <p className="readout mt-1.5 flex items-center gap-1.5 text-ink/70">
            <CalendarRange className="h-3.5 w-3.5" aria-hidden />
            {fmtDate(trip.startDate)} – {fmtDate(trip.endDate)}
          </p>
        </div>
        {city?.tier === "basic" && <DataTierBadge tier="basic" />}
      </div>

      {/* lodging → drive-time ranking, same mechanics as TripCard */}
      <div className="mt-5 rounded-lg border border-paper-line bg-paper px-3 py-2.5">
        {trip.lodging ? (
          <div className="flex items-start justify-between gap-2">
            <p className="readout flex min-w-0 items-center gap-1.5 text-ink/80">
              <BedDouble className="h-3.5 w-3.5 shrink-0" aria-hidden />
              <span className="truncate normal-case tracking-normal">{trip.lodging.label}</span>
            </p>
            <button
              type="button"
              onClick={() => tripId && setLodging(tripId, null)}
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

      {/* the trip's own gyms — order preserved from trip.gymIds */}
      <section className="mt-7">
        <h2 className="display text-lg text-ink">Gyms on this trip</h2>
        <div className="mt-2 space-y-3">
          {tripGyms === null ? (
            <>
              <div className="skeleton h-16 w-full rounded-lg" />
              <div className="skeleton h-16 w-full rounded-lg" />
            </>
          ) : tripGyms.length === 0 ? (
            <p className="py-4 text-sm text-ink/70">
              No gyms saved yet — add some from Scout&apos;s picks below.
            </p>
          ) : (
            tripGyms.map((g) => {
              const mins = driveMins.get(g.id);
              return (
                <div key={g.id} className="space-y-1">
                  <GymRow
                    gym={asScored(g)}
                    onRemove={handleRemoveFromTrip}
                    extraMeta={mins !== undefined ? `~${mins} min drive` : undefined}
                  />
                  <p className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 pl-3 text-[11px] text-ink/60">
                    <span>{atTheDoorLine(g, now)}</span>
                    <span className="opacity-40" aria-hidden>
                      ·
                    </span>
                    <span>{stayLabel(openDuringStay(g.hours, trip.startDate, trip.endDate), trip.startDate, trip.endDate)}</span>
                  </p>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Scout's picks at the destination — top matches minus gyms already on the trip */}
      <section className="mt-8">
        <h2 className="display text-lg text-ink">Scout&apos;s picks</h2>
        <p className="readout mt-1 text-ink/70">
          {trip.lodging
            ? "Closest fits to where you're staying"
            : usingPrefs
              ? "Matched to your current filters"
              : "Scout's picks at your destination"}
        </p>
        <div className="mt-2 space-y-2">
          {picks === null ? (
            <>
              <div className="skeleton h-16 w-full rounded-lg" />
              <div className="skeleton h-16 w-full rounded-lg" />
            </>
          ) : picks.length === 0 ? (
            <p className="py-4 text-sm text-ink/70">
              No more gyms to suggest here yet — you may have already added them all.
            </p>
          ) : (
            picks.map((g) => {
              const mins = driveMins.get(g.id);
              return (
                <div key={g.id} className="flex items-start gap-2">
                  <div className="min-w-0 flex-1 space-y-1">
                    <GymRow gym={g} extraMeta={mins !== undefined ? `~${mins} min drive` : undefined} />
                    <p className="pl-3 text-[11px] text-ink/60">
                      {stayLabel(openDuringStay(g.hours, trip.startDate, trip.endDate), trip.startDate, trip.endDate)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleAddToTrip(g.id)}
                    aria-label={`Add ${g.name} to trip`}
                    className="flex h-9 shrink-0 items-center gap-1 rounded-md border border-paper-line px-2.5 text-ink/75 transition-colors hover:border-blaze hover:text-blaze"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden />
                    <span className="readout">Add</span>
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    </main>
  );
}
