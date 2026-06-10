"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

interface ShortlistState {
  savedIds: string[];
  isDrawerOpen: boolean;
  add: (id: string) => void;
  remove: (id: string) => void;
  toggle: (id: string) => void;
  clear: () => void;
  setDrawerOpen: (open: boolean) => void;
  /** Cloud-merge support: replace the full set (post sign-in). */
  setSavedIds: (ids: string[]) => void;
}

export const useShortlistStore = create<ShortlistState>()(
  persist(
    (set) => ({
      savedIds: [],
      isDrawerOpen: false,
      add: (id) =>
        set((s) => (s.savedIds.includes(id) ? s : { savedIds: [...s.savedIds, id] })),
      remove: (id) => set((s) => ({ savedIds: s.savedIds.filter((x) => x !== id) })),
      toggle: (id) =>
        set((s) =>
          s.savedIds.includes(id)
            ? { savedIds: s.savedIds.filter((x) => x !== id) }
            : { savedIds: [...s.savedIds, id] },
        ),
      clear: () => set({ savedIds: [] }),
      setDrawerOpen: (open) => set({ isDrawerOpen: open }),
      setSavedIds: (savedIds) => set({ savedIds }),
    }),
    {
      name: "scout-shortlist-v1",
      skipHydration: true, // rehydrated client-side by HydrationGate
      partialize: (s) => ({ savedIds: s.savedIds }) as ShortlistState,
    },
  ),
);
