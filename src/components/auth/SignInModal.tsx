"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { KeyRound, Loader2, MailCheck, Wand2, X } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";

/** OAuth providers appear only once their console apps exist and the env
 *  flag lists them, e.g. NEXT_PUBLIC_OAUTH_PROVIDERS="google,apple".
 *  (Apple is required by App Store rules once any third-party SSO ships.) */
const OAUTH_PROVIDERS = (process.env.NEXT_PUBLIC_OAUTH_PROVIDERS ?? "")
  .split(",")
  .map((p) => p.trim().toLowerCase())
  .filter((p): p is "google" | "apple" => p === "google" || p === "apple");

const PROVIDER_LABELS = { google: "Continue with Google", apple: "Continue with Apple" };

type Method = "magic" | "password";
type PasswordMode = "signin" | "signup" | "forgot";

const EMAIL_RE = /^\S+@\S+\.\S+$/;

/** Sign-in: email link (default, no password), password (sign in / create /
 *  reset), and SSO when configured. */
export function SignInModal({ onClose }: { onClose: () => void }) {
  const [method, setMethod] = useState<Method>("magic");
  const [mode, setMode] = useState<PasswordMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<null | "magic" | "reset" | "confirm">(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const emailOk = EMAIL_RE.test(email);
  const passwordOk = password.length >= 8;

  const sendMagic = async () => {
    if (busy || !emailOk) return;
    setBusy(true);
    setError(null);
    const next = `${window.location.pathname}${window.location.search}`;
    const { error: e } = await getBrowserClient().auth.signInWithOtp({
      email: email.trim(),
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    setBusy(false);
    if (e) setError("Couldn't send the link — try again in a minute.");
    else setSent("magic");
  };

  const submitPassword = async () => {
    if (busy || !emailOk) return;
    setError(null);
    const client = getBrowserClient();

    if (mode === "forgot") {
      setBusy(true);
      const { error: e } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/auth/reset`,
      });
      setBusy(false);
      if (e) setError("Couldn't send the reset email — try again in a minute.");
      else setSent("reset");
      return;
    }

    if (!passwordOk) return;
    setBusy(true);
    if (mode === "signup") {
      const next = `${window.location.pathname}${window.location.search}`;
      const { data, error: e } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        },
      });
      setBusy(false);
      if (e) {
        setError(
          /already registered/i.test(e.message)
            ? "That email already has an account — sign in instead."
            : "Couldn't create the account — try again.",
        );
      } else if (data.session) {
        onClose(); // confirmations off → signed in immediately
      } else {
        setSent("confirm"); // confirmations on → check inbox
      }
      return;
    }

    const { error: e } = await client.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setBusy(false);
    if (e) setError("Wrong email or password — or try the email-link tab.");
    else onClose();
  };

  const sso = async (provider: "google" | "apple") => {
    setError(null);
    await getBrowserClient()
      .auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      })
      .then(({ error: e }) => {
        if (e) setError("Couldn't start that sign-in — try another method.");
      });
  };

  const sentCopy = {
    magic: ["one-tap sign-in link", "Tap it and you're in — you can close this window."],
    reset: ["password reset link", "Follow it to choose a new password."],
    confirm: ["confirmation link", "Confirm it and you're in — you can close this window."],
  } as const;

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
              Check <b>{email.trim()}</b> for a {sentCopy[sent][0]}.{" "}
              {sentCopy[sent][1]}
            </p>
          </div>
        ) : (
          <>
            {OAUTH_PROVIDERS.length > 0 && (
              <>
                <div className="mt-4 flex flex-col gap-2">
                  {OAUTH_PROVIDERS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => void sso(p)}
                      className="display flex h-11 items-center justify-center rounded-lg border border-ink/20 bg-paper text-sm tracking-wide text-ink transition-colors hover:border-ink/50"
                    >
                      {PROVIDER_LABELS[p]}
                    </button>
                  ))}
                </div>
                <div className="mt-4 flex items-center gap-3" aria-hidden>
                  <span className="h-px flex-1 bg-paper-line" />
                  <span className="font-mono text-[10px] uppercase tracking-wider text-ink/50">
                    or
                  </span>
                  <span className="h-px flex-1 bg-paper-line" />
                </div>
              </>
            )}

            <div className="mt-4 rounded-lg border border-pool/30 bg-pool-tint/40 p-3">
              <p className="text-xs leading-relaxed text-ink/75">
                Sync saves &amp; trips across devices · Log visits + honest
                membership-vs-day-pass math · Follow gyms for change alerts
              </p>
            </div>

            <div
              role="tablist"
              aria-label="Sign-in method"
              className="mt-4 grid grid-cols-2 gap-1 rounded-lg border border-paper-line bg-paper p-1"
            >
              {(
                [
                  ["magic", "Email link", Wand2],
                  ["password", "Password", KeyRound],
                ] as const
              ).map(([m, label, Icon]) => (
                <button
                  key={m}
                  type="button"
                  role="tab"
                  aria-selected={method === m}
                  onClick={() => {
                    setMethod(m);
                    setError(null);
                  }}
                  className={`font-mono flex items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-[11px] uppercase tracking-wide transition-colors ${
                    method === m ? "bg-ink text-paper" : "text-ink/65 hover:text-ink"
                  }`}
                >
                  <Icon className="h-3 w-3" aria-hidden />
                  {label}
                </button>
              ))}
            </div>

            <p className="mt-3 text-xs leading-relaxed text-ink/70">
              {method === "magic"
                ? "One email, one tap — no password to remember."
                : mode === "signup"
                  ? "Create your Scout account — 8+ character password."
                  : mode === "forgot"
                    ? "We'll email you a link to choose a new password."
                    : "Welcome back."}
            </p>

            <form
              className="mt-3 flex flex-col gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                void (method === "magic" ? sendMagic() : submitPassword());
              }}
            >
              <input
                ref={inputRef}
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                aria-label="Email address"
                autoComplete="email"
                className="font-mono h-11 rounded-lg border border-paper-line bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink/45 focus:border-pool"
              />
              {method === "password" && mode !== "forgot" && (
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={mode === "signup" ? "Choose a password (8+ chars)" : "Password"}
                  aria-label="Password"
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className="font-mono h-11 rounded-lg border border-paper-line bg-paper px-3 text-sm text-ink outline-none placeholder:text-ink/45 focus:border-pool"
                />
              )}
              <button
                type="submit"
                disabled={
                  busy ||
                  !emailOk ||
                  (method === "password" && mode !== "forgot" && !passwordOk)
                }
                className="display flex h-11 items-center justify-center gap-2 rounded-lg bg-blaze-deep text-sm tracking-wider text-white transition-colors hover:bg-blaze disabled:opacity-50"
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
                {method === "magic"
                  ? "Send sign-in link"
                  : mode === "signup"
                    ? "Create account"
                    : mode === "forgot"
                      ? "Send reset link"
                      : "Sign in"}
              </button>
            </form>

            {method === "password" && (
              <div className="mt-3 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setMode(mode === "signup" ? "signin" : "signup");
                    setError(null);
                  }}
                  className="readout text-pool-deep hover:underline"
                >
                  {mode === "signup" ? "Have an account? Sign in" : "New here? Create account"}
                </button>
                {mode !== "forgot" ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("forgot");
                      setError(null);
                    }}
                    className="readout text-ink/55 hover:text-ink"
                  >
                    Forgot password?
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setMode("signin")}
                    className="readout text-ink/55 hover:text-ink"
                  >
                    Back to sign in
                  </button>
                )}
              </div>
            )}

            {error && <p className="mt-2 text-xs text-blaze-deep">{error}</p>}
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}
