"use client";

import { Copy } from "lucide-react";
import type { HoursMap } from "@/lib/types/scout";

type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
const DAYS: { key: DayKey; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

// Toggling a day "Open" reveals BLANK time pickers — we never auto-fill a
// fabricated 6a–9p the gym may not actually keep (never-fabricate).
const BLANK_DAY: [string, string] = ["", ""];

/** Midnight close is stored "24:00" (end-of-day) to match isOpenNow in
 *  scorer.ts — the single source of hours truth (AGENTS.md gotcha). */
function normalizeClose(v: string): string {
  return v === "00:00" ? "24:00" : v;
}
function toInput(v: string): string {
  return v === "24:00" ? "00:00" : v;
}
/** close earlier than open ⇒ the gym closes the NEXT day (e.g. 5a–1a). */
function isOvernight(open: string, close: string): boolean {
  return !!open && !!close && close !== "24:00" && close < open;
}

export function HoursGrid({
  value,
  onChange,
}: {
  value: HoursMap | null;
  onChange: (v: HoursMap | null) => void;
}) {
  const hours = value ?? {};

  const patch = (next: HoursMap) => {
    // Strip open_24h — the grid manages day windows only; the access model
    // (section B) owns the 24-hour question. Prevents the prefilled flag from
    // contradicting specific day hours.
    const clean = { ...next };
    delete clean.open_24h;
    // drop empty → null so "no hours given" stays unlisted
    const hasAny = DAYS.some((d) => clean[d.key]);
    onChange(hasAny ? clean : null);
  };

  const setDay = (day: DayKey, tuple: [string, string] | undefined) => {
    const next = { ...hours };
    if (tuple) next[day] = tuple;
    else delete next[day];
    patch(next);
  };

  const setTime = (day: DayKey, idx: 0 | 1, v: string) => {
    const cur = hours[day] ?? BLANK_DAY;
    const tuple: [string, string] = [cur[0], cur[1]];
    tuple[idx] = idx === 1 ? normalizeClose(v) : v;
    setDay(day, tuple);
  };

  const applyMonToWeek = () => {
    const mon = hours.mon;
    if (!mon) return;
    const next = { ...hours };
    (["tue", "wed", "thu", "fri"] as DayKey[]).forEach((d) => {
      next[d] = [mon[0], mon[1]];
    });
    patch(next);
  };

  return (
    <div className="space-y-1.5">
      <button
        type="button"
        onClick={applyMonToWeek}
        disabled={!hours.mon}
        className="readout mb-1 flex items-center gap-1.5 rounded px-1.5 py-1 text-ink/55 hover:text-ink disabled:cursor-not-allowed disabled:text-ink/25"
      >
        <Copy className="h-3 w-3" aria-hidden /> Apply Mon to Tue–Fri
      </button>
      {DAYS.map(({ key, label }) => {
        const open = hours[key];
        return (
          <div key={key} className="flex items-center gap-3">
            <span className="readout w-10 text-ink/70">{label}</span>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink/70">
              <input
                type="checkbox"
                checked={!!open}
                onChange={(e) => setDay(key, e.target.checked ? BLANK_DAY : undefined)}
                className="h-3.5 w-3.5 accent-blaze"
              />
              {open ? "Open" : "Closed"}
            </label>
            {open && (
              <div className="flex items-center gap-1.5">
                <input
                  type="time"
                  value={toInput(open[0])}
                  onChange={(e) => setTime(key, 0, e.target.value)}
                  className="font-mono rounded border border-paper-line bg-paper-raise px-2 py-1 text-xs text-ink focus:border-ink/40 focus:outline-none"
                />
                <span className="text-ink/40">–</span>
                <input
                  type="time"
                  value={toInput(open[1])}
                  onChange={(e) => setTime(key, 1, e.target.value)}
                  className="font-mono rounded border border-paper-line bg-paper-raise px-2 py-1 text-xs text-ink focus:border-ink/40 focus:outline-none"
                />
                {isOvernight(open[0], open[1]) && (
                  <span className="readout text-pool-deep" title="closes after midnight">
                    next day
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
