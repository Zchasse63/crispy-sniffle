"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Trip } from "@/lib/types/scout";

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
        set((s) => ({
          trips: [
            ...s.trips,
            {
              ...trip,
              id: crypto.randomUUID(),
              createdAt: new Date().toISOString(),
            },
          ].sort((a, b) => a.startDate.localeCompare(b.startDate)),
        })),
      removeTrip: (id) => set((s) => ({ trips: s.trips.filter((t) => t.id !== id) })),
      setTrips: (trips) => set({ trips }),
      setLodging: (id, lodging) =>
        set((s) => ({
          trips: s.trips.map((t) => (t.id === id ? { ...t, lodging } : t)),
        })),
    }),
    {
      name: "scout-trips-v1",
      skipHydration: true, // rehydrated client-side by HydrationGate
    },
  ),
);
