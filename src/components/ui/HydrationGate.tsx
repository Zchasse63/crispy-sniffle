"use client";

import { useEffect, useState } from "react";
import { AuthGate } from "@/components/auth/AuthGate";
import { useShortlistStore } from "@/stores/shortlistStore";
import { useTripStore } from "@/stores/tripStore";

/**
 * Persisted stores use skipHydration so server HTML and the first client
 * render agree (empty state). This gate rehydrates them from localStorage
 * after mount — children render immediately, saved state pops in post-mount.
 *
 * AuthGate mounts ONLY after both rehydrations settle: merge-on-signin
 * reads local store state, and a SIGNED_IN event racing rehydration would
 * silently union an EMPTY local set (data loss for returning users).
 */
export function HydrationGate({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    void Promise.all([
      useShortlistStore.persist.rehydrate(),
      useTripStore.persist.rehydrate(),
    ]).then(() => setHydrated(true));
  }, []);
  return (
    <>
      {hydrated && <AuthGate />}
      {children}
    </>
  );
}
