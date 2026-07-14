"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Trip } from "@/lib/types/scout";
import { getBrowserClient } from "@/lib/supabase/browser";
import { useUserStore } from "@/stores/userStore";

/** Best-effort cloud sync for signed-in users. Rows are matched on the
 *  (city, start, end) tuple — local and cloud row ids legitimately diverge
 *  after merge-on-signin. Failures are swallowed; localStorage remains the
 *  device source of truth.
 *
 *  gym_ids has its own dedicated "gymIds" op and must NEVER ride along in the
 *  "upsert" payload: addTrip's upsert fires on every add and resolves on the
 *  tuple conflict, writing the WHOLE row — if gym_ids were included there, a
 *  re-add of the same trip (e.g. from a second device) would overwrite this
 *  device's cloud gym_ids with whatever the adding device had (often empty). */
function cloudSync(op: "upsert" | "delete" | "lodging" | "gymIds", trip: Trip): void {
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
        : op === "gymIds"
          ? client.from("cloud_trips").update({ gym_ids: trip.gymIds }).match(tuple)
          : client.from("cloud_trips").upsert(
              { ...tuple, city_name: trip.cityName, lodging: trip.lodging ?? null },
              { onConflict: "user_id,city_slug,start_date,end_date", ignoreDuplicates: false },
            );
  void run.then(undefined, () => {});
}

interface TripState {
  trips: Trip[];
  addTrip: (trip: Omit<Trip, "id" | "createdAt" | "gymIds">) => void;
  removeTrip: (id: string) => void;
  setLodging: (id: string, lodging: Trip["lodging"]) => void;
  /** Idempotent — adding an already-present gym is a no-op (no duplicates, no cloud call). */
  addGymToTrip: (tripId: string, gymId: string) => void;
  /** Idempotent — removing an absent gym is a no-op. */
  removeGymFromTrip: (tripId: string, gymId: string) => void;
  /** Cloud-merge support: replace the full list (post sign-in). */
  setTrips: (trips: Trip[]) => void;
}

/** Pre-gymIds localStorage shape (persist version 0). */
type LegacyPersistedTrip = Omit<Trip, "gymIds"> & { gymIds?: string[] };

export const useTripStore = create<TripState>()(
  persist(
    (set) => ({
      trips: [],
      addTrip: (trip) =>
        set((s) => {
          const full: Trip = {
            ...trip,
            id: crypto.randomUUID(),
            createdAt: new Date().toISOString(),
            gymIds: [],
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
      addGymToTrip: (tripId, gymId) =>
        set((s) => {
          let changed = false;
          const next = s.trips.map((t) => {
            if (t.id !== tripId) return t;
            const gymIds = t.gymIds ?? [];
            if (gymIds.includes(gymId)) return t;
            changed = true;
            return { ...t, gymIds: [...gymIds, gymId] };
          });
          if (changed) {
            const target = next.find((t) => t.id === tripId);
            if (target) cloudSync("gymIds", target);
          }
          return { trips: next };
        }),
      removeGymFromTrip: (tripId, gymId) =>
        set((s) => {
          let changed = false;
          const next = s.trips.map((t) => {
            if (t.id !== tripId) return t;
            const gymIds = t.gymIds ?? [];
            if (!gymIds.includes(gymId)) return t;
            changed = true;
            return { ...t, gymIds: gymIds.filter((id) => id !== gymId) };
          });
          if (changed) {
            const target = next.find((t) => t.id === tripId);
            if (target) cloudSync("gymIds", target);
          }
          return { trips: next };
        }),
    }),
    {
      name: "scout-trips-v1",
      skipHydration: true, // rehydrated client-side by HydrationGate
      // v1: backfills gymIds onto trips persisted before it existed. Zustand
      // always wrote a numeric `version` (default 0) alongside state, so this
      // bump reliably fires migrate() for every pre-existing localStorage blob.
      version: 1,
      migrate: (persisted) => {
        const state = persisted as { trips?: LegacyPersistedTrip[] } | null;
        return {
          trips: (state?.trips ?? []).map((t) => ({ ...t, gymIds: t.gymIds ?? [] })),
        } as TripState;
      },
    },
  ),
);
