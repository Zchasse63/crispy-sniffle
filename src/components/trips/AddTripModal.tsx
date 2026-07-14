"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchCities } from "@/lib/queries/gyms";
import type { City } from "@/lib/types/scout";
import { useTripStore } from "@/stores/tripStore";
import { useFocusTrap } from "@/lib/useFocusTrap";

export function AddTripModal({ onClose }: { onClose: () => void }) {
  const addTrip = useTripStore((s) => s.addTrip);
  const [cities, setCities] = useState<City[]>([]);
  const [citySlug, setCitySlug] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  useFocusTrap(dialogRef, true);
  // Initial focus via effect, NEVER JSX autoFocus — must run AFTER the trap's
  // effect snapshots the opener (declaration order; see useFocusTrap's doc).
  useEffect(() => {
    closeRef.current?.focus();
  }, []);

  useEffect(() => {
    void fetchCities(getBrowserClient()).then(setCities);
  }, []);

  // a11y: Escape closes the modal
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const city = cities.find((c) => c.slug === citySlug);
    if (!city) return setError("Pick a destination.");
    if (!startDate || !endDate) return setError("Pick your dates.");
    if (endDate < startDate) return setError("The trip can't end before it starts.");
    addTrip({ citySlug: city.slug, cityName: city.name, startDate, endDate });
    onClose();
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50"
      role="dialog"
      aria-modal="true"
      aria-label="Add trip"
    >
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="absolute inset-0 bg-ink/50 backdrop-blur-sm"
      />
      <div className="absolute left-1/2 top-1/2 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-paper-line bg-paper p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="display text-xl text-ink">Add a trip</h2>
          <button
            type="button"
            ref={closeRef}
            onClick={onClose}
            aria-label="Close"
            className="flex h-9 w-9 items-center justify-center rounded-md border border-paper-line text-ink hover:border-ink/40"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 text-xs leading-relaxed text-ink/70">
          Tell Scout where you&apos;re headed — it&apos;ll line up gyms at your destination
          that match what you train.
        </p>

        <form onSubmit={submit} className="mt-5 space-y-4">
          <label className="block">
            <span className="readout text-ink/70">Destination</span>
            <select
              value={citySlug}
              onChange={(e) => setCitySlug(e.target.value)}
              className="font-mono mt-1.5 w-full rounded-lg border border-paper-line bg-paper-raise px-3 py-2.5 text-sm uppercase tracking-wide text-ink focus:border-ink/40 focus:outline-none"
            >
              <option value="">Choose a city…</option>
              {cities.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name}, {c.state}
                  {c.tier === "rich" ? " · full Scout data" : " · limited data"}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="readout text-ink/70">From</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="font-mono mt-1.5 w-full rounded-lg border border-paper-line bg-paper-raise px-3 py-2.5 text-sm text-ink focus:border-ink/40 focus:outline-none"
              />
            </label>
            <label className="block">
              <span className="readout text-ink/70">To</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="font-mono mt-1.5 w-full rounded-lg border border-paper-line bg-paper-raise px-3 py-2.5 text-sm text-ink focus:border-ink/40 focus:outline-none"
              />
            </label>
          </div>
          {error && (
            <p role="alert" className="text-xs font-semibold text-blaze">
              {error}
            </p>
          )}
          <button
            type="submit"
            className="display w-full rounded-lg bg-blaze-deep px-4 py-3 text-sm tracking-wider text-white transition-colors hover:bg-blaze"
          >
            Add trip
          </button>
        </form>
      </div>
    </div>
  );
}
