import { CalendarCheck, DoorOpen, Gift, Lock, Ticket } from "lucide-react";
import { DROP_IN_LABELS, type DropInPolicy, type EnrichedGym } from "@/lib/types/scout";

const POLICY_ICONS: Record<DropInPolicy, React.ComponentType<{ className?: string }>> = {
  walk_in: DoorOpen,
  book_first: CalendarCheck,
  restricted: Lock,
  trial_route: Gift,
  membership_only: Ticket,
};

const POLICY_TONES: Record<DropInPolicy, string> = {
  walk_in: "border-pool-deep bg-pool-tint text-ink",
  book_first: "border-contour-deep bg-paper text-ink",
  restricted: "border-blaze/50 bg-blaze/10 text-ink",
  trial_route: "border-pool-deep bg-pool-tint text-ink",
  membership_only: "border-ink/30 bg-paper text-ink",
};

/** Membership break-even: the visit count where monthly beats day passes. */
function breakEven(monthly: number, dayPass: number): number {
  return Math.ceil(monthly / dayPass);
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  return `${n}${mod10 === 1 ? "st" : mod10 === 2 ? "nd" : mod10 === 3 ? "rd" : "th"}`;
}

/**
 * "How do I actually get in?" — drop-in friction + membership math.
 * Policy and pricing are gym-published (R6 curation from the scrape corpus).
 */
export function DropInCard({ gym }: { gym: EnrichedGym }) {
  if (!gym.drop_in_policy && !gym.drop_in_note && gym.monthly_from === null) return null;
  const Icon = gym.drop_in_policy ? POLICY_ICONS[gym.drop_in_policy] : DoorOpen;
  const dayPass = gym.day_pass_price !== null ? Number(gym.day_pass_price) : null;
  const visits =
    gym.monthly_from !== null && dayPass !== null && dayPass > 0
      ? breakEven(gym.monthly_from, dayPass)
      : null;

  return (
    <section className="rounded-xl border border-paper-line bg-paper-raise p-5">
      <h2 className="readout flex items-center gap-1.5 text-ink/65">
        <DoorOpen className="h-3.5 w-3.5" aria-hidden /> Getting in
      </h2>

      {gym.drop_in_policy && (
        <span
          className={`font-mono mt-3 inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] uppercase tracking-wide ${POLICY_TONES[gym.drop_in_policy]}`}
        >
          <Icon className="h-3.5 w-3.5" aria-hidden />
          {DROP_IN_LABELS[gym.drop_in_policy]}
        </span>
      )}

      {gym.drop_in_note && (
        <p className="mt-2.5 text-sm leading-relaxed text-ink/85">{gym.drop_in_note}</p>
      )}

      {gym.monthly_from !== null && (
        <p
          className="mt-3 border-t border-paper-line/60 pt-3 text-sm text-ink"
          title={gym.monthly_note ?? undefined}
        >
          Memberships from{" "}
          <span className="font-mono font-semibold">
            ${Number(gym.monthly_from) % 1 === 0
              ? Number(gym.monthly_from).toFixed(0)
              : Number(gym.monthly_from).toFixed(2)}
            /mo
          </span>
        </p>
      )}

      {visits !== null && visits > 1 && (
        <p className="mt-1.5 text-xs leading-relaxed text-ink/70">
          Day passes beat the membership until your{" "}
          <b>{ordinal(visits)} visit</b>{" "}
          each month — going more often, joining wins.
        </p>
      )}
    </section>
  );
}
