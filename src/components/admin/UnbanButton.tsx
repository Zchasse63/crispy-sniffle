"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UnbanButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        const res = await fetch(`/admin/api/users/${userId}`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ action: "unban" }),
        });
        setBusy(false);
        if (res.ok) router.refresh();
      }}
      className="rounded-md border border-paper-line px-2.5 py-1 text-xs text-ink transition-colors hover:border-pool/40 disabled:opacity-50"
    >
      {busy ? "…" : "Unban"}
    </button>
  );
}
