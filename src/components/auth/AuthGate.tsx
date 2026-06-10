"use client";

import { useEffect } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { mergeUserData } from "@/lib/merge";
import { useUserStore } from "@/stores/userStore";

/** Invisible listener: keeps userStore in sync with Supabase auth and runs
 *  the one-time local→cloud merge on sign-in. */
export function AuthGate() {
  const setUser = useUserStore((s) => s.setUser);
  const setLoading = useUserStore((s) => s.setLoading);

  useEffect(() => {
    const client = getBrowserClient();
    client.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setLoading(false);
    });
    const { data: sub } = client.auth.onAuthStateChange((event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (event === "SIGNED_IN" && session?.user) {
        // sessionStorage: once per browser session, not per reload (the
        // merge is idempotent, but re-running it on every load is waste)
        const key = `scout-merged-${session.user.id}`;
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, "1");
          void mergeUserData(session.user.id);
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [setUser, setLoading]);

  return null;
}
