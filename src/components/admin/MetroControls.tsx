"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Inline tier toggle for a metro row. */
export function TierToggle({ id, tier }: { id: string; tier: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const next = tier === "rich" ? "basic" : "rich";
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Change tier from ${tier} to ${next}? This changes how the public app renders the metro.`)) return;
        setBusy(true);
        const res = await fetch(`/admin/api/metros/${id}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ tier: next }),
        });
        setBusy(false);
        if (res.ok) router.refresh();
      }}
      className="rounded-md border border-paper-line px-2 py-0.5 text-xs text-mist transition-colors hover:border-pool/40 hover:text-ink disabled:opacity-50"
    >
      {busy ? "…" : `→ ${next}`}
    </button>
  );
}

/** Add-metro form. */
export function AddMetroForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ name: "", state: "", lat: "", lng: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/admin/api/metros", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) setError(json.error ?? "Could not create metro");
    else {
      setOpen(false);
      setForm({ name: "", state: "", lat: "", lng: "" });
      router.refresh();
    }
  }

  const inputCls =
    "rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-pool";

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-ink-deep"
      >
        Add metro
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-2 rounded-lg border border-paper-line bg-paper-raise p-2">
      <input required placeholder="Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
      <input required placeholder="State" maxLength={2} value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} className={`${inputCls} w-16`} />
      <input required placeholder="Lat" inputMode="decimal" value={form.lat} onChange={(e) => setForm({ ...form, lat: e.target.value })} className={`${inputCls} w-24`} />
      <input required placeholder="Lng" inputMode="decimal" value={form.lng} onChange={(e) => setForm({ ...form, lng: e.target.value })} className={`${inputCls} w-24`} />
      <button type="submit" disabled={busy} className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink-deep disabled:opacity-50">
        {busy ? "…" : "Create"}
      </button>
      <button type="button" onClick={() => setOpen(false)} className="text-sm text-mist hover:text-ink">
        Cancel
      </button>
      {error && <p className="w-full text-xs text-blaze-deep">{error}</p>}
    </form>
  );
}
