"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Check } from "lucide-react";
import type { InviteRow } from "@/lib/admin/submissions";
import { Pill } from "@/components/admin/ui";

interface GymOpt {
  id: string;
  name: string;
  cityName: string | null;
}

const STATUS_TONE: Record<string, "good" | "warn" | "neutral" | "info"> = {
  active: "good",
  used: "info",
  revoked: "neutral",
  expired: "neutral",
};

export function InviteManager({ gyms, invites }: { gyms: GymOpt[]; invites: InviteRow[] }) {
  const router = useRouter();
  const [gymId, setGymId] = useState(gyms[0]?.id ?? "");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minted, setMinted] = useState<{
    link: string;
    gymName: string;
    emailed?: { ok: boolean; redirected?: boolean; to?: string; error?: string } | null;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  async function mint() {
    setBusy(true);
    setError(null);
    setMinted(null);
    try {
      const res = await fetch("/admin/api/invites", {
        method: "POST",
        headers: { "content-type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ gym_id: gymId, email: email.trim() || undefined }),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not mint invite");
      } else {
        const link = json.link ?? `${window.location.origin}${json.path}`;
        setMinted({ link, gymName: json.gymName, emailed: json.emailed });
        setEmail("");
        router.refresh();
      }
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  async function revoke(id: string) {
    const res = await fetch(`/admin/api/invites/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ action: "revoke" }),
    });
    if (res.ok) router.refresh();
  }

  function copy(link: string) {
    navigator.clipboard?.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-paper-line bg-paper-raise p-4">
        <h2 className="readout mb-3 text-xs uppercase tracking-widest text-mist">Mint an invite</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-mist">Gym</span>
            <select
              value={gymId}
              onChange={(e) => setGymId(e.target.value)}
              className="min-w-56 rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-pool"
            >
              {gyms.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                  {g.cityName ? ` · ${g.cityName}` : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-xs text-mist">Owner email (optional)</span>
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="owner@gym.com"
              className="rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-pool"
            />
          </label>
          <button
            type="button"
            onClick={mint}
            disabled={busy || !gymId}
            className="rounded-md bg-ink px-4 py-1.5 text-sm font-semibold text-paper transition-colors hover:bg-ink-deep disabled:opacity-50"
          >
            {busy ? "Minting…" : "Mint invite"}
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-blaze-deep">{error}</p>}
        {minted && (
          <div className="mt-3 rounded-lg border border-pool/30 bg-pool-tint/40 p-3">
            <p className="mb-1.5 text-xs text-pool-deep">
              Invite link for <span className="font-medium">{minted.gymName}</span> — shown once, copy it now:
            </p>
            <div className="flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded bg-paper px-2 py-1 text-xs text-ink">{minted.link}</code>
              <button
                type="button"
                onClick={() => copy(minted.link)}
                className="flex shrink-0 items-center gap-1 rounded-md border border-paper-line px-2 py-1 text-xs text-ink hover:border-pool/40"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-pool" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>
            {minted.emailed && (
              <p className="mt-2 text-xs text-mist">
                {minted.emailed.ok
                  ? minted.emailed.redirected
                    ? `Email sent in TEST mode → it went to your test inbox (${minted.emailed.to}), not the owner. Verify a domain to send for real.`
                    : `Invite emailed to ${minted.emailed.to}.`
                  : `Email not sent: ${minted.emailed.error ?? "unknown error"}. Copy the link above and send it manually.`}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto rounded-xl border border-paper-line">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b border-paper-line bg-paper-raise text-left">
              {["Gym", "Email", "Status", "Created", "Expires", ""].map((h, i) => (
                <th key={i} className="px-3 py-2 readout text-[11px] uppercase tracking-wider text-mist">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id} className="border-b border-paper-line/60 last:border-0">
                <td className="px-3 py-2 text-ink">{inv.gymName ?? "—"}</td>
                <td className="px-3 py-2 text-mist">{inv.email ?? "—"}</td>
                <td className="px-3 py-2">
                  <Pill tone={STATUS_TONE[inv.status] ?? "neutral"}>{inv.status}</Pill>
                </td>
                <td className="px-3 py-2 text-mist">{new Date(inv.createdAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-mist">
                  {inv.expiresAt ? new Date(inv.expiresAt).toLocaleDateString() : "—"}
                </td>
                <td className="px-3 py-2 text-right">
                  {inv.status === "active" && (
                    <button
                      type="button"
                      onClick={() => revoke(inv.id)}
                      className="text-xs text-blaze-deep hover:underline"
                    >
                      Revoke
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {invites.length === 0 && (
              <tr>
                <td colSpan={6} className="px-3 py-8 text-center text-sm text-mist">
                  No invites yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
