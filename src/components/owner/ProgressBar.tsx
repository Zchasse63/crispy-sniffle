"use client";

import { Check, ShieldCheck } from "lucide-react";
import { FORM_SECTIONS } from "@/lib/owner/formConfig";

/** Thin top progress strip + the two badge thresholds (Owner Listed at the end
 *  of the short path, Gym Verified at the end). */
export function ProgressBar({
  completed,
  activeSection,
  onJump,
  ownerListed,
}: {
  completed: Set<string>;
  activeSection: string;
  onJump: (sectionId: string) => void;
  /** Earned from real answers (never-fabricate), not navigation. */
  ownerListed: boolean;
}) {
  const total = FORM_SECTIONS.length;
  const done = FORM_SECTIONS.filter((s) => completed.has(s.id)).length;
  const pct = Math.round((done / total) * 100);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="readout text-ink/55">
          {done} of {total} done
        </span>
        <span className="readout inline-flex items-center gap-1.5 text-ink/55">
          {ownerListed ? (
            <>
              <ShieldCheck className="h-3.5 w-3.5 text-pool-deep" aria-hidden /> Owner Listed unlocked
            </>
          ) : (
            "Owner Listed at the basics"
          )}
        </span>
      </div>

      <div className="h-1.5 w-full overflow-hidden rounded-full bg-paper-line">
        <div className="h-full rounded-full bg-blaze transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {FORM_SECTIONS.map((s) => {
          const isDone = completed.has(s.id);
          const isActive = s.id === activeSection;
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onJump(s.id)}
              className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] transition-colors ${
                isActive
                  ? "border-ink bg-ink text-paper"
                  : isDone
                    ? "border-pool/40 bg-pool-tint text-pool-deep"
                    : "border-paper-line bg-paper-raise text-ink/55 hover:border-ink/40"
              }`}
            >
              {isDone && !isActive && <Check className="h-2.5 w-2.5" strokeWidth={3} aria-hidden />}
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
