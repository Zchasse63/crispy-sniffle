"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SEGMENT_OPTIONS } from "@/lib/admin/gymFields";

interface CityOpt {
  id: string;
  name: string | null;
  state: string | null;
}

const inputCls =
  "w-full rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-pool";

export function AddGymForm({ cities }: { cities: CityOpt[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: "",
    city_id: cities[0]?.id ?? "",
    segment: "",
    address: "",
    website: "",
    phone: "",
    lat: "",
    lng: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function field<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/admin/api/gyms", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Could not create gym");
        setBusy(false);
        return;
      }
      router.push(`/admin/gyms/${json.id}`);
    } catch {
      setError("Network error");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="max-w-xl rounded-xl border border-paper-line bg-paper-raise p-5">
      <div className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="readout text-[11px] uppercase tracking-widest text-mist">Name *</span>
          <input required value={form.name} onChange={(e) => field("name", e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="readout text-[11px] uppercase tracking-widest text-mist">Metro *</span>
          <select required value={form.city_id} onChange={(e) => field("city_id", e.target.value)} className={inputCls}>
            {cities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.state ? `, ${c.state}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="readout text-[11px] uppercase tracking-widest text-mist">Segment</span>
          <select value={form.segment} onChange={(e) => field("segment", e.target.value)} className={inputCls}>
            <option value="">— Unlisted —</option>
            {SEGMENT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm">
          <span className="readout text-[11px] uppercase tracking-widest text-mist">Address</span>
          <input
            value={form.address}
            onChange={(e) => field("address", e.target.value)}
            placeholder="Used for auto-geocoding"
            className={inputCls}
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="readout text-[11px] uppercase tracking-widest text-mist">Website</span>
            <input value={form.website} onChange={(e) => field("website", e.target.value)} className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="readout text-[11px] uppercase tracking-widest text-mist">Phone</span>
            <input value={form.phone} onChange={(e) => field("phone", e.target.value)} className={inputCls} />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="readout text-[11px] uppercase tracking-widest text-mist">Latitude</span>
            <input value={form.lat} onChange={(e) => field("lat", e.target.value)} inputMode="decimal" placeholder="auto" className={inputCls} />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="readout text-[11px] uppercase tracking-widest text-mist">Longitude</span>
            <input value={form.lng} onChange={(e) => field("lng", e.target.value)} inputMode="decimal" placeholder="auto" className={inputCls} />
          </label>
        </div>
        {error && <p className="text-xs text-blaze-deep">{error}</p>}
        <button
          type="submit"
          disabled={busy}
          className="mt-1 self-start rounded-md bg-ink px-4 py-2 text-sm font-semibold text-paper transition-colors hover:bg-ink-deep disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create gym"}
        </button>
      </div>
    </form>
  );
}
