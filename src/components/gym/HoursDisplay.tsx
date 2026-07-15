"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import type { HoursMap } from "@/lib/types/scout";
import { isOpenNow } from "@/lib/scoring/scorer";
import { relativeTime } from "@/lib/time";
import { FactConfirm } from "@/components/community/FactConfirm";

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

export function HoursDisplay({
  gymId,
  hours,
  hoursVerifiedAt,
  ownerVerified,
  confirms,
  lastConfirmedAt,
}: {
  gymId: string;
  hours: HoursMap | null;
  /** gyms.hours_verified_at — null until an owner publish or enrich.mjs
   *  writes `hours` (never backfilled for existing rows). */
  hoursVerifiedAt: string | null;
  /** Gym-level owner/verified signal (gym.verified || gym.owner_listed) —
   *  gates the "Owner-verified" wording tier vs. the generic "Updated" one.
   *  Never conflate: this is NOT the same signal as a community confirm. */
  ownerVerified: boolean;
  confirms: number;
  /** confirmation_counts.last_confirmed_at for fact_type='hours',
   *  fact_key='hours' — a real verdict='confirm' event, not a row touch. */
  lastConfirmedAt: string | null;
}) {
  // open-now computed client-side so it reflects the visitor's clock;
  // rAF-deferred so the setState isn't synchronous inside the effect body
  // (react-hooks/set-state-in-effect — same pattern as GymCard/FilterRail)
  const [open, setOpen] = useState<boolean | null>(null);
  const [today, setToday] = useState<number | null>(null);
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      setOpen(hours?.open_24h ? true : isOpenNow(hours));
      setToday(new Date().getDay()); // 0=Sun
    });
    return () => cancelAnimationFrame(id);
  }, [hours]);

  // Tier wording matrix (never conflate): the verified-at stamp alone reads
  // "Updated"; it only earns "Owner-verified" when the gym-level owner/
  // verified signal applies. A community confirm is always its own line —
  // "Confirmed by a member" — regardless of whether a stamp exists too.
  const stampText = hoursVerifiedAt
    ? `${ownerVerified ? "Owner-verified" : "Updated"} ${relativeTime(hoursVerifiedAt)}`
    : null;
  const memberText = lastConfirmedAt ? `Confirmed by a member ${relativeTime(lastConfirmedAt)}` : null;

  return (
    <section className="rounded-xl border border-paper-line bg-paper-raise p-5">
      <div className="flex items-center justify-between">
        <h2 className="readout flex items-center gap-1.5 text-ink/65">
          <Clock className="h-3.5 w-3.5" aria-hidden /> Hours
        </h2>
        {open !== null && (
          <span
            className={`readout inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ${
              open ? "bg-pool-tint text-pool-deep" : "bg-paper text-ink/65 border border-paper-line"
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
        <p className="mt-4 text-sm text-ink/65">
          Hours not yet on file — check the gym&apos;s website.
        </p>
      )}

      {hours && (
        <div className="group/fact mt-3 flex items-center justify-between gap-2 border-t border-paper-line/60 pt-3">
          <p className="font-mono text-[10px] uppercase tracking-wide text-ink/45">
            {stampText}
            {stampText && memberText && <span className="mx-1 opacity-50">·</span>}
            {memberText}
          </p>
          <FactConfirm gymId={gymId} factType="hours" factKey="hours" confirms={confirms} />
        </div>
      )}
    </section>
  );
}
