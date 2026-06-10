"use client";

import { useEffect, useRef, useState } from "react";
import { Car, Footprints, LocateFixed, X } from "lucide-react";
import { fetchIsochrone, type TravelMode } from "@/lib/travel";
import { useFilterStore } from "@/stores/filterStore";

const MINUTE_OPTIONS = [10, 20, 30];

/** "Within X minutes of me" — geolocation + Mapbox isochrone, applied as a
 *  geographic pre-filter ahead of scoring. Degrades politely: no token, no
 *  permission, or API failure all land on an inline note, never a break. */
export function NearMeFilter() {
  const travel = useFilterStore((s) => s.travel);
  const setTravel = useFilterStore((s) => s.setTravel);
  const [mode, setMode] = useState<TravelMode>("driving");
  // geolocation runs async (permission dialog) — read mode through a ref so
  // a mid-flight mode switch can't produce a polygon labeled with the old mode
  const modeRef = useRef(mode);
  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);
  const [pending, setPending] = useState<number | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const activate = (minutes: number) => {
    setNote(null);
    setPending(minutes);
    if (!navigator.geolocation) {
      setNote("Location isn't available in this browser.");
      setPending(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const origin = { lng: pos.coords.longitude, lat: pos.coords.latitude };
        const liveMode = modeRef.current;
        const polygon = await fetchIsochrone(origin, minutes, liveMode);
        setPending(null);
        if (!polygon) {
          setNote("Couldn't compute travel reach — try again in a moment.");
          return;
        }
        setTravel({ minutes, mode: liveMode, origin, polygon });
      },
      () => {
        setPending(null);
        setNote("Location permission was declined — Near me needs it to work.");
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 120000 },
    );
  };

  return (
    <div>
      <div className="flex items-center gap-1.5">
        {(
          [
            ["driving", Car, "Drive"],
            ["walking", Footprints, "Walk"],
          ] as const
        ).map(([m, Icon, label]) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => {
              setMode(m);
              if (travel) setTravel(null); // mode change invalidates the polygon
            }}
            className={`font-mono flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] uppercase tracking-wide transition-colors ${
              mode === m
                ? "border-ink bg-ink text-paper"
                : "border-paper-line bg-paper-raise text-ink/70 hover:text-ink"
            }`}
          >
            <Icon className="h-3 w-3" aria-hidden /> {label}
          </button>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        {MINUTE_OPTIONS.map((m) => {
          const active = travel?.minutes === m;
          return (
            <button
              key={m}
              type="button"
              aria-pressed={active}
              disabled={pending !== null}
              onClick={() => (active ? setTravel(null) : activate(m))}
              className={`font-mono rounded-md border px-2.5 py-1.5 text-[11px] uppercase tracking-wide transition-colors disabled:opacity-50 ${
                active
                  ? "border-pool-deep bg-pool-tint text-ink"
                  : "border-paper-line bg-paper-raise text-ink/75 hover:border-ink/40 hover:text-ink"
              }`}
            >
              {pending === m ? (
                "Locating…"
              ) : (
                <>
                  <LocateFixed className="mr-1 inline h-3 w-3" aria-hidden />
                  {m} min
                </>
              )}
            </button>
          );
        })}
        {travel && (
          <button
            type="button"
            onClick={() => setTravel(null)}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] text-ink/65 transition-colors hover:text-blaze"
          >
            <X className="h-3 w-3" aria-hidden /> Clear
          </button>
        )}
      </div>
      {note && <p className="mt-2 text-[11px] leading-relaxed text-ink/65">{note}</p>}
      {travel && (
        <p className="mt-2 text-[11px] text-ink/65">
          Showing gyms within a {travel.minutes}-minute{" "}
          {travel.mode === "driving" ? "drive" : "walk"} of your location.
        </p>
      )}
    </div>
  );
}
