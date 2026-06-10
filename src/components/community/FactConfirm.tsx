"use client";

import { useState } from "react";
import { Check, Pencil, Users } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { useUserStore } from "@/stores/userStore";

/**
 * Per-fact community verification — the mechanic that keeps Scout's data
 * honest. Signed-in users confirm ("still accurate") or correct a fact;
 * rows land in fact_confirmations at the 'user' trust tier for promotion.
 * Everyone sees the confirmation count once it exists.
 */
export function FactConfirm({
  gymId,
  factType,
  factKey,
  confirms,
}: {
  gymId: string;
  factType: "amenity" | "equipment" | "price" | "hours";
  factKey: string;
  confirms: number;
}) {
  const user = useUserStore((s) => s.user);
  const [state, setState] = useState<"idle" | "correcting" | "sent">("idle");
  const [correction, setCorrection] = useState("");
  // no optimistic count bump: an upsert may UPDATE the user's prior row
  // (no new confirmation) — the chip refreshes from the counts RPC on the
  // next page load, and "Logged ✓" acknowledges the action immediately.

  const send = async (verdict: "confirm" | "correct") => {
    if (!user) return;
    setState("sent");
    await getBrowserClient()
      .from("fact_confirmations")
      .upsert(
        {
          user_id: user.id,
          gym_id: gymId,
          fact_type: factType,
          fact_key: factKey,
          verdict,
          corrected_value: verdict === "correct" ? correction.trim().slice(0, 120) || null : null,
        },
        { onConflict: "user_id,gym_id,fact_type,fact_key" },
      )
      .then(undefined, () => {});
  };

  return (
    <span className="flex shrink-0 items-center gap-1.5">
      {confirms > 0 && (
        <span
          className="font-mono inline-flex items-center gap-1 rounded border border-pool/40 bg-pool-tint/50 px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-pool-deep"
          title={`${confirms} member${confirms > 1 ? "s" : ""} confirmed this fact`}
        >
          <Users className="h-3 w-3" aria-hidden />
          {confirms}
        </span>
      )}
      {user && state === "idle" && (
        <span className="flex items-center gap-1 opacity-0 transition-opacity group-hover/fact:opacity-100 focus-within:opacity-100 [@media(hover:none)]:opacity-100">
          <button
            type="button"
            onClick={() => void send("confirm")}
            title="Confirm — this is still accurate"
            aria-label="Confirm this fact is accurate"
            className="rounded border border-paper-line p-1 text-ink/55 transition-colors hover:border-pool hover:text-pool-deep"
          >
            <Check className="h-3 w-3" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setState("correcting")}
            title="Suggest a correction"
            aria-label="Suggest a correction to this fact"
            className="rounded border border-paper-line p-1 text-ink/55 transition-colors hover:border-blaze hover:text-blaze"
          >
            <Pencil className="h-3 w-3" aria-hidden />
          </button>
        </span>
      )}
      {state === "correcting" && (
        <form
          className="flex items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            void send("correct");
          }}
        >
          <input
            autoFocus
            value={correction}
            onChange={(e) => setCorrection(e.target.value)}
            placeholder="What's right?"
            aria-label="Corrected value"
            className="font-mono h-6 w-28 rounded border border-paper-line bg-paper px-1.5 text-[10px] text-ink outline-none focus:border-pool"
          />
          <button
            type="submit"
            className="font-mono rounded bg-blaze-deep px-1.5 py-1 text-[9px] uppercase text-white"
          >
            Send
          </button>
        </form>
      )}
      {state === "sent" && (
        <span className="font-mono text-[9.5px] uppercase tracking-wide text-pool-deep">
          Logged ✓
        </span>
      )}
    </span>
  );
}
