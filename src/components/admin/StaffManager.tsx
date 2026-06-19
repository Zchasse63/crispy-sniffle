"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { StaffEntry } from "@/lib/admin/system";
import { Pill } from "@/components/admin/ui";

const ROLES = ["owner", "admin", "reviewer", "viewer"];

export function StaffManager({ staff, selfId }: { staff: StaffEntry[]; selfId: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("reviewer");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);

  async function grant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const res = await fetch("/admin/api/staff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ email, role }),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) setMsg({ tone: "err", text: json.error ?? "Grant failed" });
    else {
      setMsg({ tone: "ok", text: `Granted ${role} to ${email}.` });
      setEmail("");
      router.refresh();
    }
  }

  async function revoke(userId: string, label: string) {
    if (!confirm(`Revoke access for ${label}?`)) return;
    const res = await fetch(`/admin/api/staff/${userId}`, { method: "DELETE", credentials: "same-origin" });
    if (res.ok) router.refresh();
    else setMsg({ tone: "err", text: (await res.json()).error ?? "Revoke failed" });
  }

  const inputCls =
    "rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-pool";

  return (
    <div className="flex flex-col gap-5">
      <form onSubmit={grant} className="rounded-xl border border-paper-line bg-paper-raise p-4">
        <h2 className="readout mb-3 text-xs uppercase tracking-widest text-mist">Grant access</h2>
        <div className="flex flex-wrap items-end gap-2">
          <input
            required
            type="email"
            placeholder="person@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputCls} min-w-56`}
          />
          <select value={role} onChange={(e) => setRole(e.target.value)} className={inputCls}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={busy}
            className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink-deep disabled:opacity-50"
          >
            {busy ? "…" : "Grant"}
          </button>
        </div>
        {msg && <p className={`mt-2 text-xs ${msg.tone === "ok" ? "text-pool-deep" : "text-blaze-deep"}`}>{msg.text}</p>}
        <p className="mt-2 text-xs text-mist">The person must have signed up first. Roles: owner &gt; admin &gt; reviewer &gt; viewer.</p>
      </form>

      <div className="overflow-hidden rounded-xl border border-paper-line">
        <ul className="divide-y divide-paper-line/60">
          {staff.map((s) => (
            <li key={s.userId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-ink">{s.email ?? s.userId}</p>
                <p className="text-xs text-mist">Since {new Date(s.createdAt).toLocaleDateString()}</p>
              </div>
              <div className="flex items-center gap-2">
                <Pill tone={s.role === "owner" ? "good" : "info"}>{s.role}</Pill>
                {s.userId !== selfId && (
                  <button
                    type="button"
                    onClick={() => revoke(s.userId, s.email ?? s.userId)}
                    className="flex items-center gap-1 rounded-md border border-paper-line px-2 py-1 text-xs text-blaze-deep hover:border-blaze/40"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Revoke
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
