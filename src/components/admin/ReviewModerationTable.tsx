"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { EyeOff, Eye, Trash2, Ban } from "lucide-react";
import type { ReviewRow } from "@/lib/admin/moderation";
import { Pill } from "@/components/admin/ui";

export function ReviewModerationTable({ reviews }: { reviews: ReviewRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  async function moderate(id: string, action: "hide" | "restore" | "delete") {
    if (action === "delete" && !confirm("Permanently delete this review? This cannot be undone.")) return;
    setBusy(`${id}:${action}`);
    setMsg(null);
    const res = await fetch(`/admin/api/reviews/${id}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action }),
    });
    setBusy(null);
    if (res.ok) router.refresh();
    else setMsg((await res.json()).error ?? "Action failed");
  }

  async function banAuthor(userId: string) {
    const reason = prompt("Reason for banning this user? (their reviews will be hidden)");
    if (reason === null) return;
    setBusy(`${userId}:ban`);
    const res = await fetch(`/admin/api/users/${userId}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "ban", reason }),
    });
    setBusy(null);
    if (res.ok) router.refresh();
    else setMsg((await res.json()).error ?? "Ban failed");
  }

  if (reviews.length === 0) {
    return <p className="px-4 py-12 text-center text-sm text-mist">No reviews match this filter.</p>;
  }

  return (
    <div>
      {msg && <p className="mb-2 text-xs text-blaze-deep">{msg}</p>}
      <div className="flex flex-col gap-3">
        {reviews.map((r) => (
          <div
            key={r.id}
            className={`rounded-xl border p-4 ${r.hidden ? "border-paper-line bg-paper-raise/40 opacity-70" : "border-paper-line bg-paper-raise"}`}
          >
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-medium text-ink">{r.gymName ?? "Unknown gym"}</span>
              <Pill tone={r.rating >= 4 ? "good" : r.rating >= 3 ? "neutral" : "bad"}>{r.rating.toFixed(1)}★</Pill>
              {r.reportCount > 0 && <Pill tone="warn">{r.reportCount} report(s)</Pill>}
              {r.hidden && <Pill tone="neutral">Hidden</Pill>}
              <span className="ml-auto text-xs text-mist">{new Date(r.createdAt).toLocaleDateString()}</span>
            </div>
            {r.comment && <p className="mb-2 text-sm text-ink">{r.comment}</p>}
            {r.moderationReason && <p className="mb-2 text-xs text-mist">Mod note: {r.moderationReason}</p>}
            <div className="flex flex-wrap items-center gap-2">
              {r.hidden ? (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => moderate(r.id, "restore")}
                  className="flex items-center gap-1 rounded-md border border-paper-line px-2 py-1 text-xs text-ink hover:border-pool/40 disabled:opacity-50"
                >
                  <Eye className="h-3.5 w-3.5" /> Restore
                </button>
              ) : (
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => moderate(r.id, "hide")}
                  className="flex items-center gap-1 rounded-md border border-paper-line px-2 py-1 text-xs text-ink hover:border-blaze/40 disabled:opacity-50"
                >
                  <EyeOff className="h-3.5 w-3.5" /> Hide
                </button>
              )}
              <button
                type="button"
                disabled={!!busy}
                onClick={() => moderate(r.id, "delete")}
                className="flex items-center gap-1 rounded-md border border-paper-line px-2 py-1 text-xs text-blaze-deep hover:border-blaze/40 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
              <button
                type="button"
                disabled={!!busy}
                onClick={() => banAuthor(r.userId)}
                className="flex items-center gap-1 rounded-md border border-paper-line px-2 py-1 text-xs text-blaze-deep hover:border-blaze/40 disabled:opacity-50"
              >
                <Ban className="h-3.5 w-3.5" /> Ban author
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
