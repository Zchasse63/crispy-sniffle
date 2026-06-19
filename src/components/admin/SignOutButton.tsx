"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await getBrowserClient().auth.signOut();
        router.push("/admin/login");
        router.refresh();
      }}
      className="flex items-center gap-1.5 rounded-md border border-paper-line px-2.5 py-1 text-xs text-mist transition-colors hover:border-blaze/40 hover:text-blaze disabled:opacity-50"
    >
      <LogOut className="h-3.5 w-3.5" aria-hidden />
      {busy ? "Signing out…" : "Sign out"}
    </button>
  );
}
