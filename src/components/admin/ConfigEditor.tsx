"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { ConfigEntry } from "@/lib/admin/system";

export function ConfigEditor({ entries }: { entries: ConfigEntry[] }) {
  const router = useRouter();
  const [newKey, setNewKey] = useState("");
  const [newValue, setNewValue] = useState("");
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(key: string, rawValue: string) {
    let value: unknown;
    try {
      value = JSON.parse(rawValue);
    } catch {
      setMsg({ tone: "err", text: `Value for "${key}" must be valid JSON (use "quotes" for strings).` });
      return;
    }
    setBusy(true);
    setMsg(null);
    const res = await fetch("/admin/api/config", {
      method: "POST",
      headers: { "content-type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ key, value }),
    });
    setBusy(false);
    if (!res.ok) setMsg({ tone: "err", text: (await res.json()).error ?? "Save failed" });
    else {
      setMsg({ tone: "ok", text: `Saved "${key}".` });
      setNewKey("");
      setNewValue("");
      router.refresh();
    }
  }

  async function remove(key: string) {
    if (!confirm(`Delete config key "${key}"?`)) return;
    const res = await fetch(`/admin/api/config?key=${encodeURIComponent(key)}`, {
      method: "DELETE",
      credentials: "same-origin",
    });
    if (res.ok) router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {msg && <p className={`text-xs ${msg.tone === "ok" ? "text-pool-deep" : "text-blaze-deep"}`}>{msg.text}</p>}

      <div className="overflow-hidden rounded-xl border border-paper-line">
        {entries.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-mist">No config keys yet. Add a feature flag below.</p>
        ) : (
          <ul className="divide-y divide-paper-line/60">
            {entries.map((e) => (
              <ConfigRow key={e.key} entry={e} onSave={save} onRemove={remove} busy={busy} />
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-paper-line bg-paper-raise p-4">
        <h2 className="readout mb-2 text-xs uppercase tracking-widest text-mist">Add config key</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            placeholder="key (e.g. kill_ai_search)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
            className="rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-pool"
          />
          <input
            placeholder='JSON value (e.g. true, "x", {"n":1})'
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            className="min-w-56 flex-1 rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-pool"
          />
          <button
            type="button"
            disabled={busy || !newKey.trim()}
            onClick={() => save(newKey.trim(), newValue)}
            className="rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper hover:bg-ink-deep disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfigRow({
  entry,
  onSave,
  onRemove,
  busy,
}: {
  entry: ConfigEntry;
  onSave: (key: string, value: string) => void;
  onRemove: (key: string) => void;
  busy: boolean;
}) {
  const [value, setValue] = useState(JSON.stringify(entry.value));
  const dirty = value !== JSON.stringify(entry.value);
  return (
    <li className="flex flex-wrap items-center gap-2 px-4 py-2.5">
      <code className="w-44 shrink-0 truncate text-sm text-ink">{entry.key}</code>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={`min-w-40 flex-1 rounded-md border bg-paper px-2.5 py-1 font-mono text-xs text-ink outline-none focus:border-pool ${
          dirty ? "border-pool/50" : "border-paper-line"
        }`}
      />
      <button
        type="button"
        disabled={busy || !dirty}
        onClick={() => onSave(entry.key, value)}
        className="rounded-md bg-ink px-2.5 py-1 text-xs font-medium text-paper hover:bg-ink-deep disabled:opacity-40"
      >
        Save
      </button>
      <button
        type="button"
        onClick={() => onRemove(entry.key)}
        className="rounded-md border border-paper-line px-1.5 py-1 text-blaze-deep hover:border-blaze/40"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}
