"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getBrowserClient } from "@/lib/supabase/browser";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: signInError } = await getBrowserClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (signInError) {
      setError("Invalid credentials.");
      setBusy(false);
      return;
    }
    // Server layout re-checks staff membership and 404s if not staff.
    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="readout text-[11px] uppercase tracking-widest text-mist">Email</span>
        <input
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-pool"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="readout text-[11px] uppercase tracking-widest text-mist">Password</span>
        <input
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink outline-none focus:border-pool"
        />
      </label>
      {error && <p className="text-xs text-blaze-deep">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="mt-1 rounded-md bg-ink px-3 py-2 text-sm font-semibold text-paper transition-colors hover:bg-ink-deep disabled:opacity-50"
      >
        {busy ? "Signing in…" : "Sign in"}
      </button>
    </form>
  );
}
