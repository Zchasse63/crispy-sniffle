import { CircleDashed, DoorOpen, Lock } from "lucide-react";
import { deriveAccessStatus, type AccessFields, type AccessTone } from "@/lib/access";

const TONE_ICONS: Record<AccessTone, React.ComponentType<{ className?: string }>> = {
  open: DoorOpen,
  restricted: Lock,
  unknown: CircleDashed,
};

const TONE_STYLES: Record<AccessTone, string> = {
  open: "border-pool-deep bg-pool-tint text-ink",
  restricted: "border-blaze/50 bg-blaze/10 text-ink",
  unknown: "border-contour bg-paper text-ink/60",
};

/**
 * Compact chip for `deriveAccessStatus` (lib/access.ts) — "how do I get in?"
 * distilled to one label. Not mounted anywhere yet; a later integration task
 * places it on GymCard/GymRow (`card`) and the gym detail identity strip
 * (`detail`).
 *
 * `card`: renders nothing when nothing is derivable — noise control, since
 * only ~5% of gyms carry a drop-in policy today and most cards would
 * otherwise show the same "call ahead" chip.
 * `detail`: always renders, including the call-ahead fallback — the gym page
 * is the one place Scout owes a full answer, never silence.
 */
export function AccessBadge({
  gym,
  context,
}: {
  gym: AccessFields;
  context: "card" | "detail";
}) {
  const status = deriveAccessStatus(gym);
  if (context === "card" && !status.derivable) return null;

  const Icon = TONE_ICONS[status.tone];
  return (
    <span
      title={status.note ?? undefined}
      className={`font-mono inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] uppercase tracking-wide ${TONE_STYLES[status.tone]}`}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden />
      {status.label}
    </span>
  );
}
