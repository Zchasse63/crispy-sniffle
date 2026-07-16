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
  const [state, setState] = useState<"idle" | "correcting" | "sent" | "error">("idle");
  const [correction, setCorrection] = useState("");
  // no optimistic count bump: an upsert may UPDATE the user's prior row
  // (no new confirmation) — the chip refreshes from the counts RPC on the
  // next page load, and "Logged ✓" acknowledges only a confirmed write.

  const send = async (verdict: "confirm" | "correct") => {
    if (!user) return;
    setState("sent");
    // Writes go through the security-definer confirm_fact() RPC, which validates
    // that the (gym, fact_type, fact_key) references a REAL current fact —
    // direct fact_confirmations inserts are no longer permitted (a fabricated
    // fact_key would otherwise inflate the public "confirmed this week" count).
    const { error } = await getBrowserClient().rpc("confirm_fact", {
      p_gym: gymId,
      p_fact_type: factType,
      p_fact_key: factKey,
      p_verdict: verdict,
      p_corrected_value: verdict === "correct" ? correction.trim().slice(0, 120) || null : null,
      p_note: null,
    });
    if (error) setState("error"); // don't claim "Logged" on a failed write
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
          {/* Touch target ≥44px via an invisible ::before hit-area, not visible
              padding — these two buttons sit only 4px apart, so each one only
              grows AWAY from its neighbor (never toward it) to avoid turning a
              tap meant for one into a mis-tap on the other. */}
          <button
            type="button"
            onClick={() => void send("confirm")}
            title="Confirm — this is still accurate"
            aria-label="Confirm this fact is accurate"
            className="relative rounded border border-paper-line p-1 text-ink/55 transition-colors before:absolute before:-bottom-2.5 before:-left-2.5 before:right-0 before:-top-2.5 before:content-[''] hover:border-pool hover:text-pool-deep"
          >
            <Check className="h-3 w-3" aria-hidden />
          </button>
          <button
            type="button"
            onClick={() => setState("correcting")}
            title="Suggest a correction"
            aria-label="Suggest a correction to this fact"
            className="relative rounded border border-paper-line p-1 text-ink/55 transition-colors before:absolute before:-bottom-2.5 before:-right-2.5 before:-top-2.5 before:left-0 before:content-[''] hover:border-blaze hover:text-blaze"
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
        <span role="status" className="font-mono text-[9.5px] uppercase tracking-wide text-pool-deep">
          Logged ✓
        </span>
      )}
      {state === "error" && (
        <button
          type="button"
          onClick={() => setState("idle")}
          className="font-mono text-[9.5px] uppercase tracking-wide text-blaze-deep"
          title="That didn't save — tap to retry"
        >
          <span role="status" className="sr-only">
            That didn&apos;t save —{" "}
          </span>
          Retry
        </button>
      )}
    </span>
  );
}
