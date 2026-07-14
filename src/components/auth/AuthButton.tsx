"use client";

import Link from "next/link";
import { useState } from "react";
import { CircleUserRound } from "lucide-react";
import { useUserStore } from "@/stores/userStore";
import { SignInModal } from "./SignInModal";

export function AuthButton() {
  const user = useUserStore((s) => s.user);
  const isLoading = useUserStore((s) => s.isLoading);
  const [modal, setModal] = useState(false);

  if (isLoading) {
    // same footprint as the signed-out button — no nav layout shift while
    // rehydration + getUser settle (signed-in users see ghost→avatar swap)
    return (
      <span
        aria-hidden
        className="readout flex items-center gap-1.5 rounded-md border border-paper-line p-2 text-ink/45 sm:px-2.5 sm:py-1.5"
      >
        <CircleUserRound className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
        <span className="hidden sm:inline">Sign in</span>
      </span>
    );
  }

  if (user) {
    const initial = (user.email ?? "?")[0]?.toUpperCase();
    return (
      <Link
        href="/me"
        aria-label="Your profile"
        title={user.email ?? "Your profile"}
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-pool/50 bg-pool-tint font-mono text-xs font-semibold text-pool-deep transition-colors before:absolute before:-top-3 before:-bottom-3 before:left-0 before:right-0 before:content-[''] hover:border-pool"
      >
        {initial}
      </Link>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setModal(true)}
        aria-label="Sign in"
        className="readout relative flex items-center gap-1.5 rounded-md border border-paper-line p-2 text-ink/80 transition-colors before:absolute before:-top-3 before:-bottom-3 before:left-0 before:right-0 before:content-[''] hover:border-pool hover:text-pool-deep sm:px-2.5 sm:py-1.5"
      >
        <CircleUserRound className="h-4 w-4 sm:h-3.5 sm:w-3.5" aria-hidden />
        <span className="hidden sm:inline">Sign in</span>
      </button>
      {modal && <SignInModal onClose={() => setModal(false)} />}
    </>
  );
}
