"use client";

import { useEffect } from "react";
import { useShortlistStore } from "@/stores/shortlistStore";
import { useTripStore } from "@/stores/tripStore";

/**
 * Persisted stores use skipHydration so server HTML and the first client
 * render agree (empty state). This gate rehydrates them from localStorage
 * after mount — children render immediately, saved state pops in post-mount.
 */
export function HydrationGate({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    void useShortlistStore.persist.rehydrate();
    void useTripStore.persist.rehydrate();
  }, []);
  return <>{children}</>;
}
