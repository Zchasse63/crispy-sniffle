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
        className="readout flex items-center gap-1.5 rounded-md border border-paper-line/20 px-2.5 py-1.5 text-paper/40"
      >
        <CircleUserRound className="h-3.5 w-3.5" /> Sign in
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
        className="flex h-8 w-8 items-center justify-center rounded-full border border-pool/50 bg-pool-tint font-mono text-xs font-semibold text-pool-deep transition-colors hover:border-pool"
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
        className="readout flex items-center gap-1.5 rounded-md border border-paper-line/30 px-2.5 py-1.5 text-paper/85 transition-colors hover:border-pool hover:text-paper"
      >
        <CircleUserRound className="h-3.5 w-3.5" aria-hidden /> Sign in
      </button>
      {modal && <SignInModal onClose={() => setModal(false)} />}
    </>
  );
}
