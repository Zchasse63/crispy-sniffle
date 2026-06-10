"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { HoursMap } from "@/lib/types/scout";
import { isOpenNow } from "@/lib/scoring/scorer";

// Sun-first to match Date.getDay() and scorer.ts DAY_KEYS — one canonical
// day-index scheme everywhere (a divergence here silently breaks the highlight).
const DAYS: { key: keyof HoursMap; label: string }[] = [
  { key: "sun", label: "Sunday" },
  { key: "mon", label: "Monday" },
  { key: "tue", label: "Tuesday" },
  { key: "wed", label: "Wednesday" },
  { key: "thu", label: "Thursday" },
  { key: "fri", label: "Friday" },
  { key: "sat", label: "Saturday" },
];

function fmt(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (h === 24 || (h === 0 && m === 0)) return "Midnight";
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${m ? `:${String(m).padStart(2, "0")}` : ""} ${am ? "AM" : "PM"}`;
}

export function HoursDisplay({ hours }: { hours: HoursMap | null }) {
  // open-now computed client-side so it reflects the visitor's clock
  const [open, setOpen] = useState<boolean | null>(null);
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => {
    setOpen(hours?.open_24h ? true : isOpenNow(hours));
    setToday(new Date().getDay()); // 0=Sun
  }, [hours]);

  return (
    <section className="rounded-xl border border-paper-line bg-paper-raise p-5">
      <div className="flex items-center justify-between">
        <h2 className="readout flex items-center gap-1.5 text-ink/50">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Hours
        </h2>
        {open !== null && (
          <span
            className={`readout inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              open ? "bg-pool-tint text-pool-deep" : "bg-paper text-ink/50 border border-paper-line"
            }`}
          >
            <span
              className={`h-1.5 w-1.5 rounded-full ${open ? "bg-pool" : "bg-contour"}`}
              aria-hidden
            />
            {open ? "Open now" : "Closed now"}
          </span>
        )}
      </div>

      {hours?.open_24h ? (
        <p className="font-mono mt-4 text-sm uppercase tracking-wide text-ink">
          Open 24 hours, every day
        </p>
      ) : hours ? (
        <table className="mt-4 w-full text-sm">
          <tbody>
            {DAYS.map(({ key, label }, i) => {
              const range = hours[key] as [string, string] | undefined;
              const isToday = today === i;
              return (
                <tr
                  key={key}
                  className={`border-b border-paper-line/60 last:border-b-0 ${
                    isToday ? "text-ink font-semibold" : "text-ink/70"
                  }`}
                >
                  <td className="py-1.5">{label}</td>
                  <td className="font-mono py-1.5 text-right text-xs uppercase tracking-wide">
                    {range ? `${fmt(range[0])} – ${fmt(range[1])}` : "Closed"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      ) : (
        <p className="mt-4 text-sm text-ink/50">
          Hours not yet on file — check the gym&apos;s website.
        </p>
      )}
    </section>
  );
}
