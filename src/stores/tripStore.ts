"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Trip } from "@/lib/types/scout";
import { getBrowserClient } from "@/lib/supabase/browser";
import { useUserStore } from "@/stores/userStore";

/** Best-effort cloud sync for signed-in users. Rows are matched on the
 *  (city, start, end) tuple — local and cloud row ids legitimately diverge
 *  after merge-on-signin. Failures are swallowed; localStorage remains the
 *  device source of truth. */
function cloudSync(op: "upsert" | "delete" | "lodging", trip: Trip): void {
  const user = useUserStore.getState().user;
  if (!user) return;
  const client = getBrowserClient();
  const tuple = {
    user_id: user.id,
    city_slug: trip.citySlug,
    start_date: trip.startDate,
    end_date: trip.endDate,
  };
  const run =
    op === "delete"
      ? client.from("cloud_trips").delete().match(tuple)
      : op === "lodging"
        ? client.from("cloud_trips").update({ lodging: trip.lodging ?? null }).match(tuple)
        : client.from("cloud_trips").upsert(
            { ...tuple, city_name: trip.cityName, lodging: trip.lodging ?? null },
            { onConflict: "user_id,city_slug,start_date,end_date", ignoreDuplicates: false },
          );
  void run.then(undefined, () => {});
}

interface TripState {
  trips: Trip[];
  addTrip: (trip: Omit<Trip, "id" | "createdAt">) => void;
  removeTrip: (id: string) => void;
  setLodging: (id: string, lodging: Trip["lodging"]) => void;
  /** Cloud-merge support: replace the full list (post sign-in). */
  setTrips: (trips: Trip[]) => void;
}

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      trips: [],
      addTrip: (trip) =>
        set((s) => {
          const full = {
            ...trip,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
          };
          cloudSync("upsert", full);
          return {
            trips: [...s.trips, full].sort((a, b) =>
              a.startDate.localeCompare(b.startDate),
            ),
          };
        }),
      removeTrip: (id) =>
        set((s) => {
          const target = s.trips.find((t) => t.id === id);
          if (target) cloudSync("delete", target);
          return { trips: s.trips.filter((t) => t.id !== id) };
        }),
      setTrips: (trips) => set({ trips }),
      setLodging: (id, lodging) =>
        set((s) => {
          const next = s.trips.map((t) => (t.id === id ? { ...t, lodging } : t));
          const target = next.find((t) => t.id === id);
          if (target) cloudSync("lodging", target);
          return { trips: next };
        }),
    }),
    {
      name: "scout-trips-v1",
      skipHydration: true, // rehydrated client-side by HydrationGate
    },
  ),
);
