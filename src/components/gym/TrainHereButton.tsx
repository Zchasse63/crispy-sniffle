"use client";

import { useEffect, useState } from "react";
import { CalendarCheck2, Check, Loader2 } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { useUserStore } from "@/stores/userStore";
import { SignInModal } from "@/components/auth/SignInModal";
import { clearPendingAction, readPendingAction, savePendingAction } from "@/lib/pendingAction";

/** "I trained here" — logs a visit (today by default) to the profile log.
 *  Signed-out users get the sign-in modal; the value pitch IS the log.
 *
 *  A signed-out click is stashed as a pending action before the modal
 *  opens, so it survives the auth round-trip (magic-link email, or a
 *  same-session password sign-in) and auto-logs once the user lands back
 *  here authenticated — no second click needed. */
export function TrainHereButton({ gymId }: { gymId: string }) {
  const user = useUserStore((s) => s.user);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState(false);

  const logVisit = async () => {
    if (!user || busy || logged) return;
    setBusy(true);
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const { error } = await getBrowserClient()
      .from("gym_visits")
      .insert({ user_id: user.id, gym_id: gymId, visited_on: iso });
    setBusy(false);
    if (!error) setLogged(true);
  };

  // resumes a signed-out "I trained here" click once auth completes,
  // whether that's a same-session password sign-in or a magic-link
  // return trip that remounted this component on the gym page
  useEffect(() => {
    if (!user) return;
    const pending = readPendingAction();
    if (!pending || pending.gymId !== gymId) return;
    clearPendingAction();
    // deferred a tick so the resulting setBusy/setLogged updates don't fire
    // synchronously inside the effect (avoids a cascading-render re-run)
    queueMicrotask(() => void logVisit());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, gymId]);

  const onClick = () => {
    if (!user) {
      savePendingAction(gymId);
      setModal(true);
      return;
    }
    void logVisit();
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className={`readout flex items-center gap-1.5 rounded-lg border px-3.5 py-2.5 transition-colors ${
          logged
            ? "border-pool-deep bg-pool-tint text-ink"
            : "border-mist/40 text-mist hover:border-pool hover:text-paper"
        }`}
        title={logged ? "Logged to your visit history" : "Log a visit to your profile"}
      >
        {busy ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : logged ? (
          <Check className="h-3.5 w-3.5" aria-hidden />
        ) : (
          <CalendarCheck2 className="h-3.5 w-3.5" aria-hidden />
        )}
        {logged ? "Visit logged" : "I trained here"}
      </button>
      {modal && <SignInModal onClose={() => setModal(false)} />}
    </>
  );
}
