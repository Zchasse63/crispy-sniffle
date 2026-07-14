"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useTripStore } from "@/stores/tripStore";
import { TripCard } from "@/components/trips/TripCard";
import { AddTripModal } from "@/components/trips/AddTripModal";
import { EmptyState } from "@/components/ui/EmptyState";

export default function TripsPage() {
  const trips = useTripStore((s) => s.trips);
  const removeTrip = useTripStore((s) => s.removeTrip);
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      className="survey-grid mx-auto w-full max-w-3xl flex-1 px-4 py-8 sm:px-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="readout text-pool">Travel mode · free during beta</p>
          <h1 className="display mt-1 text-3xl text-ink sm:text-4xl">Trips</h1>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-ink/65">
            Headed somewhere? Scout lines up gyms at your destination that match
            how you train — full detail where we&apos;ve mapped, honest limits where
            we haven&apos;t.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          className="display flex items-center gap-2 rounded-lg bg-blaze-deep px-4 py-3 text-sm tracking-wider text-white transition-colors hover:bg-blaze"
        >
          <Plus className="h-4 w-4" aria-hidden /> Add trip
        </button>
      </div>

      <div className="mt-7 space-y-5">
        {trips.length === 0 ? (
          <EmptyState
            title="No trips planned"
            description="Add a destination and dates — Scout will scout the territory before you land."
            action={{ label: "Add your first trip", onClick: () => setModalOpen(true) }}
          />
        ) : (
          trips.map((t) => <TripCard key={t.id} trip={t} onRemove={removeTrip} />)
        )}
      </div>

      {modalOpen && <AddTripModal onClose={() => setModalOpen(false)} />}
    </main>
  );
}
