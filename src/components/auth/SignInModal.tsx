"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Loader2, MailCheck, X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";

/** Magic-link sign-in: email → "check your inbox". No passwords. */
export function SignInModal({ onClose }: { onClose: () => void }) {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const submit = async () => {
    if (busy || !/^\S+@\S+\.\S+$/.test(email)) return;
    setBusy(true);
    setError(null);
    const { error: e } = await getBrowserClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    if (e) setError("Couldn't send the link — try again in a minute.");
    else setSent(true);
  };

  // Portal to <body>: ancestors with backdrop-filter/transform (the sticky
  // header) create containing blocks that clip fixed-position overlays —
  // opening from the header otherwise traps the modal in a 64px box (IF-01).
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-deep/60 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Sign in to Scout"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-xl border border-paper-line bg-paper-raise p-6 shadow-[0_24px_60px_-30px_rgba(22,36,46,0.6)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <h2 className="display text-xl text-ink">Sign in to Scout</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-paper-line text-ink/65 transition-colors hover:border-blaze hover:text-blaze"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {sent ? (
          <div className="mt-4 flex items-start gap-3 rounded-lg border border-pool/40 bg-pool-tint/60 p-4">
            <MailCheck className="mt-0.5 h-5 w-5 shrink-0 text-pool-deep" aria-hidden />
            <p className="text-sm leading-relaxed text-ink">
              Check <b>{email.trim()}</b> for a one-tap sign-in link. You can
              close this window.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-2 text-sm leading-relaxed text-ink/75">
              One email, one tap — no password. Log visits, save gyms across
              devices, and keep our data honest.
            </p>
            <form
              className="mt-4 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void submit();
              }}
            >
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                className="font-mono h-11 rounded-lg border border-paper-line bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink/45 focus:border-pool"
              />
              <button
                type="submit"
                disabled={busy || !/^\S+@\S+\.\S+$/.test(email)}
                className="display flex h-11 items-center justify-center gap-2 rounded-lg bg-blaze-deep text-sm tracking-wider text-white transition-colors hover:bg-blaze disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                Send sign-in link
              </button>
            </form>
            {error && <p className="mt-2 text-xs text-blaze-deep">{error}</p>}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
