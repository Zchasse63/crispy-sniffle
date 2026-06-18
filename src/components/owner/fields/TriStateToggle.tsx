"use client";

import type { TriState } from "@/lib/owner/answerTypes";

/** Yes / No / Not sure. "Not sure" (null) is always reachable — we never
 *  default an unknown to false (never-fabricate rule). */
export function TriStateToggle({
  value,
  onChange,
  yesLabel = "Yes",
  noLabel = "No",
  skipLabel = "Not sure",
}: {
  value: TriState;
  onChange: (v: TriState) => void;
  yesLabel?: string;
  noLabel?: string;
  skipLabel?: string;
}) {
  const opts: { v: TriState; label: string; active: string }[] = [
    { v: true, label: yesLabel, active: "border-pool bg-pool text-white" },
    { v: false, label: noLabel, active: "border-blaze bg-blaze text-white" },
    { v: null, label: skipLabel, active: "border-ink/50 bg-ink/10 text-ink" },
  ];
  return (
    <div className="inline-flex gap-2">
      {opts.map((o) => {
        const active = value === o.v;
        return (
          <button
            key={String(o.v)}
            type="button"
            onClick={() => onChange(o.v)}
            className={`rounded-full border px-4 py-1.5 text-[13px] transition-colors ${
              active ? o.active : "border-contour-deep/60 bg-paper-raise text-ink/75 hover:border-ink/40"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
