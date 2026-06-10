"use client";

import { useState } from "react";
import { Loader2, MailPlus } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";

/** Footer email capture: new-gym alerts + change alerts (sender lands
 *  post-beta; capture reserves the spot). Insert-only RLS. */
export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "busy" | "done" | "error">("idle");

  const submit = async () => {
    if (state === "busy" || !/^\S+@\S+\.\S+$/.test(email)) return;
    setState("busy");
    const { error } = await getBrowserClient()
      .from("email_subscribers")
      .insert({ email: email.trim().toLowerCase(), interests: ["new_gyms", "gym_changes"] });
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
      className="flex items-center gap-2"
    >
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
        disabled={state === "busy" || !/^\S+@\S+\.\S+$/.test(email)}
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
    </form>
  );
}
