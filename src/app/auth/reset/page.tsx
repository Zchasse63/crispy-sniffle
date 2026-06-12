"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";

/** Password-recovery landing: the emailed reset link arrives here through
 *  /auth/callback (which exchanged the code for a session), so updateUser
 *  works directly. */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (busy || password.length < 8) return;
    setBusy(true);
    setError(null);
    const { error: e } = await getBrowserClient().auth.updateUser({ password });
    setBusy(false);
    if (e) {
      setError(
        /expired|invalid|session/i.test(e.message)
          ? "This reset link has expired — request a fresh one from the sign-in screen."
          : "Couldn't update the password — try again.",
      );
    } else {
      router.replace("/me");
    }
  };

  return (
    <div className="mx-auto w-full max-w-sm flex-1 px-4 py-16 sm:px-6">
      <KeyRound className="h-8 w-8 text-pool" aria-hidden />
      <h1 className="display mt-3 text-2xl text-ink">Choose a new password</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink/70">
        8+ characters. You&apos;ll be signed in everywhere with it from now on.
      </p>
      <form
        className="mt-5 flex flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
      >
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password (8+ chars)"
          aria-label="New password"
          autoComplete="new-password"
          autoFocus
          className="font-mono h-11 rounded-lg border border-paper-line bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink/45 focus:border-pool"
        />
        <button
          type="submit"
          disabled={busy || password.length < 8}
          className="display flex h-11 items-center justify-center gap-2 rounded-lg bg-blaze-deep text-sm tracking-wider text-white transition-colors hover:bg-blaze disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
          Set password
        </button>
      </form>
      {error && <p className="mt-2 text-xs text-blaze-deep">{error}</p>}
    </div>
  );
}
