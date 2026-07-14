"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save, RotateCcw, ShieldCheck, ShieldAlert } from "lucide-react";
import {
  GYM_FIELD_GROUPS,
  SEGMENT_OPTIONS,
  STATUS_OPTIONS,
  DROPIN_OPTIONS,
  type GymFieldDef,
} from "@/lib/admin/gymFields";
import { Pill } from "@/components/admin/ui";

type Raw = string | number | boolean | null;
type Work = string | boolean | null; // text-ish stored as string; booleans as boolean

function toWork(def: GymFieldDef, v: Raw): Work {
  if (def.type === "boolean") return typeof v === "boolean" ? v : null;
  // Never fabricate a value for a missing field — empty renders as the
  // "Unlisted" option. (status is NOT NULL in the DB, so v is never null here.)
  if (v === null || v === undefined) return "";
  return String(v);
}

function isDirty(def: GymFieldDef, work: Work, base: Work): boolean {
  if (def.type === "boolean") return work !== base;
  return (work ?? "") !== (base ?? "");
}

function toPatchValue(def: GymFieldDef, work: Work): Raw {
  if (def.type === "boolean") return work;
  if (work === "" || work === null) return null;
  return work;
}

export function InspectorEditor({
  gymId,
  initial,
  fieldSources,
}: {
  gymId: string;
  initial: Record<string, Raw>;
  /** Each field's current provenance source (from gym_edit_log), or undefined
   *  if it's never been hand-edited or owner-published. Drives the
   *  owner-overwrite guard below — only "owner" fields require confirmation. */
  fieldSources?: Record<string, string | null | undefined>;
}) {
  const router = useRouter();
  const baseline = useMemo(() => {
    const b: Record<string, Work> = {};
    for (const g of GYM_FIELD_GROUPS) for (const f of g.fields) b[f.key] = toWork(f, initial[f.key] ?? null);
    return b;
  }, [initial]);

  const [values, setValues] = useState<Record<string, Work>>(baseline);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ tone: "ok" | "err"; text: string } | null>(null);
  // Per-field explicit "yes, overwrite the owner-confirmed value" acknowledgment.
  // Fail-safe: a key's absence here is what keeps it out of the save payload.
  const [confirmedOverwrites, setConfirmedOverwrites] = useState<Set<string>>(new Set());

  const dirtyKeys = useMemo(() => {
    const out: string[] = [];
    for (const g of GYM_FIELD_GROUPS)
      for (const f of g.fields) if (isDirty(f, values[f.key], baseline[f.key])) out.push(f.key);
    return out;
  }, [values, baseline]);

  function isOwnerGuarded(key: string): boolean {
    return fieldSources?.[key] === "owner";
  }

  // FAIL SAFE: a dirty, owner-sourced field is excluded from the payload unless
  // explicitly confirmed — there is no path that adds it otherwise. This is
  // deliberately a stricter filter of dirtyKeys, never a superset.
  const payloadKeys = useMemo(
    () => dirtyKeys.filter((key) => fieldSources?.[key] !== "owner" || confirmedOverwrites.has(key)),
    [dirtyKeys, confirmedOverwrites, fieldSources],
  );
  const guardedCount = dirtyKeys.length - payloadKeys.length;

  function set(key: string, v: Work) {
    setValues((prev) => ({ ...prev, [key]: v }));
    setMsg(null);
  }

  function toggleConfirmOverwrite(key: string) {
    setConfirmedOverwrites((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
    setMsg(null);
  }

  async function onSave() {
    if (payloadKeys.length === 0) return;
    setSaving(true);
    setMsg(null);
    const patch: Record<string, Raw> = {};
    for (const g of GYM_FIELD_GROUPS)
      for (const f of g.fields) if (payloadKeys.includes(f.key)) patch[f.key] = toPatchValue(f, values[f.key]);
    try {
      const res = await fetch(`/admin/api/gyms/${gymId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ patch }),
      });
      const json = await res.json();
      if (!res.ok) {
        setMsg({ tone: "err", text: json.error ?? "Save failed" });
      } else {
        const skipped = guardedCount > 0 ? ` (${guardedCount} owner-confirmed field${guardedCount === 1 ? "" : "s"} held back)` : "";
        setMsg({ tone: "ok", text: `Saved ${json.changed} field${json.changed === 1 ? "" : "s"}.${skipped}` });
        setConfirmedOverwrites(new Set());
        router.refresh();
      }
    } catch {
      setMsg({ tone: "err", text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  function onReset() {
    setValues(baseline);
    setConfirmedOverwrites(new Set());
    setMsg(null);
  }

  return (
    <div>
      <div className="sticky top-14 z-20 mb-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-paper-line bg-paper/95 px-3 py-2 backdrop-blur">
        <p className="text-xs text-mist">
          Hand edits save as <span className="font-medium text-pool-deep">Scout Verified</span>. Empty a field to
          mark it <span className="font-medium text-ink">Unlisted</span> — never a fabricated 0. Fields marked{" "}
          <span className="font-medium text-ink">Owner</span> require an explicit overwrite confirmation before
          they save.
        </p>
        <div className="flex items-center gap-2">
          {msg && (
            <span className={`text-xs ${msg.tone === "ok" ? "text-pool-deep" : "text-blaze-deep"}`}>{msg.text}</span>
          )}
          {dirtyKeys.length > 0 && (
            <button
              type="button"
              onClick={onReset}
              className="flex items-center gap-1 rounded-md border border-paper-line px-2 py-1 text-xs text-mist hover:text-ink"
            >
              <RotateCcw className="h-3.5 w-3.5" /> Reset
            </button>
          )}
          <button
            type="button"
            onClick={onSave}
            disabled={saving || payloadKeys.length === 0}
            className="flex items-center gap-1.5 rounded-md bg-ink px-3 py-1.5 text-sm font-medium text-paper transition-colors hover:bg-ink-deep disabled:opacity-40"
          >
            <Save className="h-4 w-4" />
            {saving ? "Saving…" : payloadKeys.length > 0 ? `Save ${payloadKeys.length}` : "Saved"}
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-5">
        {GYM_FIELD_GROUPS.map((group) => (
          <section key={group.group} className="rounded-xl border border-paper-line bg-paper-raise">
            <h3 className="readout border-b border-paper-line px-4 py-2 text-[11px] uppercase tracking-widest text-mist">
              {group.group}
            </h3>
            <div className="divide-y divide-paper-line/60">
              {group.fields.map((f) => (
                <FieldRow
                  key={f.key}
                  def={f}
                  value={values[f.key]}
                  dirty={dirtyKeys.includes(f.key)}
                  ownerSourced={isOwnerGuarded(f.key)}
                  confirmed={confirmedOverwrites.has(f.key)}
                  onChange={(v) => set(f.key, v)}
                  onToggleConfirm={() => toggleConfirmOverwrite(f.key)}
                />
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function FieldRow({
  def,
  value,
  dirty,
  ownerSourced,
  confirmed,
  onChange,
  onToggleConfirm,
}: {
  def: GymFieldDef;
  value: Work;
  dirty: boolean;
  /** current source is 'owner' — edits need explicit overwrite confirmation */
  ownerSourced: boolean;
  /** the admin has explicitly acknowledged overwriting this owner-tier fact */
  confirmed: boolean;
  onChange: (v: Work) => void;
  onToggleConfirm: () => void;
}) {
  const needsConfirm = dirty && ownerSourced && !confirmed;
  return (
    <div className={`flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:gap-4 ${dirty ? "bg-pool-tint/40" : ""}`}>
      <label className="flex w-full items-center gap-1.5 text-sm text-ink sm:w-52 sm:shrink-0">
        {def.label}
        {dirty && <span className="h-1.5 w-1.5 rounded-full bg-pool" aria-label="unsaved" />}
        {ownerSourced && (
          <Pill tone="good">
            <ShieldCheck className="h-3 w-3" aria-hidden /> Owner
          </Pill>
        )}
      </label>
      <div className="min-w-0 flex-1">
        <FieldControl def={def} value={value} onChange={onChange} />
        {needsConfirm && (
          <button
            type="button"
            onClick={onToggleConfirm}
            className="mt-1.5 flex w-full items-center gap-1.5 rounded-md border border-blaze/30 bg-blaze-tint px-2 py-1 text-left text-xs text-blaze-deep hover:bg-blaze/10"
          >
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
            This fact is owner-confirmed — overwrite?
          </button>
        )}
        {dirty && ownerSourced && confirmed && (
          <button
            type="button"
            onClick={onToggleConfirm}
            className="mt-1.5 flex items-center gap-1.5 text-xs text-mist hover:text-ink"
          >
            <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-pool" aria-hidden />
            Overwrite confirmed — will save as Scout Verified.
          </button>
        )}
      </div>
    </div>
  );
}

function FieldControl({
  def,
  value,
  onChange,
}: {
  def: GymFieldDef;
  value: Work;
  onChange: (v: Work) => void;
}) {
  const inputCls =
    "w-full rounded-md border border-paper-line bg-paper px-2.5 py-1.5 text-sm text-ink outline-none focus:border-pool";

  if (def.type === "boolean") {
    const opts: { v: boolean | null; label: string }[] = def.twoState
      ? [
          { v: true, label: "Yes" },
          { v: false, label: "No" },
        ]
      : [
          { v: true, label: "Yes" },
          { v: false, label: "No" },
          { v: null, label: "Unlisted" },
        ];
    const cur = (value as boolean | null) ?? null;
    return (
      <div className="inline-flex overflow-hidden rounded-md border border-paper-line">
        {opts.map((o, i) => {
          const active = cur === o.v;
          return (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => onChange(o.v)}
              className={`px-3 py-1 text-xs ${i > 0 ? "border-l border-paper-line" : ""} ${
                active ? "bg-ink font-medium text-paper" : "text-mist hover:bg-paper-line/50"
              }`}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    );
  }

  if (def.type === "segment" || def.type === "status" || def.type === "dropin") {
    const options =
      def.type === "segment" ? SEGMENT_OPTIONS : def.type === "status" ? STATUS_OPTIONS : DROPIN_OPTIONS;
    return (
      <select value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inputCls}>
        {!def.required && <option value="">— Unlisted —</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    );
  }

  if (def.type === "textarea") {
    return (
      <textarea
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        placeholder="Unlisted"
        className={inputCls}
      />
    );
  }

  const isNum = def.type === "number" || def.type === "currency";
  return (
    <div className="relative">
      {def.type === "currency" && (
        <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-mist">$</span>
      )}
      <input
        value={(value as string) ?? ""}
        onChange={(e) => onChange(e.target.value)}
        inputMode={isNum ? "decimal" : undefined}
        placeholder="Unlisted"
        className={`${inputCls} ${def.type === "currency" ? "pl-5" : ""}`}
      />
    </div>
  );
}
