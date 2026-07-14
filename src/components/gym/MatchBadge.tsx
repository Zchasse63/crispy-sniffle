"use client";

import { InfoPopover } from "@/components/ui/InfoPopover";

/** Deterministic match score pill. Tap/click/Enter opens a note listing why
 *  + what's missing (keeps the `title` tooltip for pointer users too). */
export function MatchBadge({
  score,
  reasons,
  missingItems,
  size = "md",
}: {
  score: number;
  reasons: string[];
  missingItems: string[];
  size?: "sm" | "md";
}) {
  const tone =
    score >= 80
      ? "bg-blaze text-white"
      : score >= 60
        ? "bg-pool text-white"
        : "bg-contour text-ink";
  const tooltip = [
    ...reasons.map((r) => `✓ ${r}`),
    ...missingItems.map((m) => `– ${m}`),
  ].join("\n");
  // The tap note (unlike the native `title` above, which floats in its own
  // OS compositing layer) is a real DOM element — on GymCard specifically it
  // opens inside a `h-40 overflow-hidden` photo strip, so a long list could
  // get visually clipped. Cap it to what a glance actually needs; the title
  // tooltip keeps the complete list for pointer users, unchanged.
  const noteReasons = reasons.slice(0, 3);
  const noteMissing = missingItems.slice(0, 2);

  return (
    <InfoPopover
      trigger={`${score} match`}
      triggerClassName={`font-mono inline-flex items-center gap-1 rounded ${tone} ${
        size === "sm" ? "px-1.5 py-0.5 text-[10px]" : "px-2 py-1 text-[11px]"
      } font-semibold uppercase tracking-wider`}
      title={tooltip || undefined}
      note={
        noteReasons.length === 0 && noteMissing.length === 0 ? (
          "No match details available."
        ) : (
          <>
            {noteReasons.length > 0 && (
              <ul className="space-y-1">
                {noteReasons.map((r) => (
                  <li key={r} className="flex items-start gap-1.5 text-ink">
                    <span className="mt-0.5 text-pool-deep" aria-hidden>
                      ✓
                    </span>
                    {r}
                  </li>
                ))}
              </ul>
            )}
            {noteMissing.length > 0 && (
              <ul className={`space-y-1 ${noteReasons.length > 0 ? "mt-1.5" : ""}`}>
                {noteMissing.map((m) => (
                  <li key={m} className="flex items-start gap-1.5 text-ink/60">
                    <span className="mt-0.5" aria-hidden>
                      –
                    </span>
                    {m}
                  </li>
                ))}
              </ul>
            )}
          </>
        )
      }
    />
  );
}
