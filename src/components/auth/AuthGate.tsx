"use client";

import { useEffect } from "react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { mergeUserData } from "@/lib/merge";
import { useUserStore } from "@/stores/userStore";

// Module-level, not per-mount: guards against a rapid second SIGNED_IN event
// (e.g. a fast token refresh re-firing before the first merge settles)
// kicking off a duplicate concurrent merge for the same user while the
// sessionStorage marker is still deliberately unset (see below).
const mergesInFlight = new Set<string>();

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
        const userId = session.user.id;
        // sessionStorage: once per browser session, not per reload (the
        // merge is idempotent, but re-running it on every load is waste).
        // The marker is set ONLY after mergeUserData resolves successfully
        // (its boolean return) — mergeUserData swallows its own errors, so
        // without this a transient failure would still mark the merge
        // "done" and nothing would ever retry it for the rest of the
        // session (S1b). On failure the key stays unset, so the next
        // SIGNED_IN or reload retries; the merge itself is idempotent.
        const key = `scout-merged-${userId}`;
        if (!sessionStorage.getItem(key) && !mergesInFlight.has(userId)) {
          mergesInFlight.add(userId);
          void mergeUserData(userId).then((succeeded) => {
            mergesInFlight.delete(userId);
            if (succeeded) sessionStorage.setItem(key, "1");
          });
        }
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [setUser, setLoading]);

  return null;
}
