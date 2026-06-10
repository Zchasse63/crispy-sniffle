"use client";

import { useState } from "react";
import { CalendarCheck2, Check, Loader2 } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { useUserStore } from "@/stores/userStore";
import { SignInModal } from "@/components/auth/SignInModal";

/** "I trained here" — logs a visit (today by default) to the profile log.
 *  Signed-out users get the sign-in modal; the value pitch IS the log. */
export function TrainHereButton({ gymId }: { gymId: string }) {
  const user = useUserStore((s) => s.user);
  const [modal, setModal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [logged, setLogged] = useState(false);

  const log = async () => {
    if (!user) {
      setModal(true);
      return;
    }
    if (busy || logged) return;
    setBusy(true);
    const today = new Date();
    const iso = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const { error } = await getBrowserClient()
      .from("gym_visits")
      .insert({ user_id: user.id, gym_id: gymId, visited_on: iso });
    setBusy(false);
    if (!error) setLogged(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void log()}
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
