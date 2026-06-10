"use client";

import { useState } from "react";
import { Loader2, MailPlus } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";

/** Footer email capture: new-gym alerts + change alerts (sender lands
 *  post-beta; capture reserves the spot). Insert-only RLS. */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [newGyms, setNewGyms] = useState(true);
  const [gymChanges, setGymChanges] = useState(true);
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  const submit = async () => {
    const interests = [
      ...(newGyms ? ["new_gyms"] : []),
      ...(gymChanges ? ["gym_changes"] : []),
    ];
    if (state === "busy" || interests.length === 0 || !/^\S+@\S+\.\S+$/.test(email)) return;
    setState("busy");
    const { error } = await getBrowserClient()
      .from("email_subscribers")
      .insert({ email: email.trim().toLowerCase(), interests });
    // unique violation = already subscribed = success for the user
    setState(error && !error.message.includes("duplicate") ? "error" : "done");
  };

  if (state === "done") {
    return (
      <p className="text-xs leading-relaxed text-pool-deep">
        You&apos;re on the list — new Tampa gyms and change alerts, no noise.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
      className="flex flex-col gap-2"
    >
      <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-paper/75">
          <input
            type="checkbox"
            checked={newGyms}
            onChange={(e) => setNewGyms(e.target.checked)}
            className="h-3 w-3 accent-blaze-deep"
          />
          New gyms
        </label>
        <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-paper/75">
          <input
            type="checkbox"
            checked={gymChanges}
            onChange={(e) => setGymChanges(e.target.checked)}
            className="h-3 w-3 accent-blaze-deep"
          />
          Changes at gyms
        </label>
      </span>
      <span className="flex items-center gap-2">
      <input
        type="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        aria-label="Email for gym alerts"
        className="font-mono h-9 min-w-0 flex-1 rounded-md border border-paper-line bg-paper px-2.5 text-xs text-ink outline-none placeholder:text-ink/45 focus:border-pool"
      />
      <button
        type="submit"
        disabled={state === "busy" || (!newGyms && !gymChanges) || !/^\S+@\S+\.\S+$/.test(email)}
        aria-label="Subscribe"
        className="flex h-9 items-center gap-1.5 rounded-md bg-blaze-deep px-3 font-mono text-[11px] uppercase tracking-wide text-white transition-colors hover:bg-blaze disabled:opacity-50"
      >
        {state === "busy" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <MailPlus className="h-3.5 w-3.5" aria-hidden />
        )}
        Alerts
      </button>
      {state === "error" && (
        <span className="text-[11px] text-blaze-deep">Try again</span>
      )}
      </span>
    </form>
  );
}
