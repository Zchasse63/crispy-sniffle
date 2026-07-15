import { CalendarCheck, DoorOpen, Gift, Lock, Ticket } from "lucide-react";
import { formatPrice } from "@/lib/access";
import { relativeTime } from "@/lib/time";
import { DROP_IN_LABELS, type DropInPolicy, type EnrichedGym } from "@/lib/types/scout";
import { FactConfirm } from "@/components/community/FactConfirm";

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

/** Membership break-even: the visit count where monthly beats day passes.
 *  Returns null for a non-positive day pass (no meaningful break-even, and
 *  guards the bare function against a divide-by-zero independent of callers). */
function breakEven(monthly: number, dayPass: number): number | null {
  if (dayPass <= 0) return null;
  return Math.ceil(monthly / dayPass);
}

function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  const mod10 = n % 10;
  return `${n}${mod10 === 1 ? "st" : mod10 === 2 ? "nd" : mod10 === 3 ? "rd" : "th"}`;
}

/** A single "label — price" fact row. Null always renders the honest
 *  "unlisted" state (never-fabricate) instead of hiding the row — day pass
 *  and week pass are unknown for most gyms today, so unlisted is the common
 *  case, not the exception. `right` hangs the community FactConfirm control
 *  off a specific row (day pass only — never week pass, per the single-key
 *  factKey='day_pass' decision). */
function PriceRow({
  label,
  amount,
  right,
}: {
  label: string;
  amount: number | null;
  right?: React.ReactNode;
}) {
  return (
    <p className="group/fact flex items-baseline gap-1.5 text-sm text-ink">
      <span className="text-ink/55">{label}</span>
      <span className="opacity-40">—</span>
      {amount !== null ? (
        <span className="font-mono font-semibold">${formatPrice(amount)}</span>
      ) : (
        <span className="text-ink/45">unlisted</span>
      )}
      {right && <span className="ml-auto">{right}</span>}
    </p>
  );
}

/**
 * "How do I actually get in?" — drop-in friction + membership math.
 * Policy and pricing are gym-published (R6 curation from the scrape corpus).
 * Day pass and week pass are unconditional fact rows so the card always
 * answers the question, even when the answer is "we don't know."
 */
export function DropInCard({
  gym,
  confirms,
  lastConfirmedAt,
}: {
  gym: EnrichedGym;
  confirms: number;
  /** confirmation_counts.last_confirmed_at for fact_type='price',
   *  fact_key='day_pass' — a real verdict='confirm' event, not a row touch. */
  lastConfirmedAt: string | null;
}) {
  const Icon = gym.drop_in_policy ? POLICY_ICONS[gym.drop_in_policy] : DoorOpen;
  const dayPass = gym.day_pass_price !== null ? Number(gym.day_pass_price) : null;
  const weekPass = gym.week_pass_price !== null ? Number(gym.week_pass_price) : null;
  const visits =
    gym.monthly_from !== null && dayPass !== null && dayPass > 0
      ? breakEven(gym.monthly_from, dayPass)
      : null;

  // Tier wording matrix (never conflate): the verified-at stamp alone reads
  // "Updated"; it only earns "Owner-verified" when the gym-level owner/
  // verified signal applies. A community confirm is always its own line.
  // Both are gated on dayPass !== null, same as the FactConfirm mount below —
  // a stamp next to an "unlisted" row would read as verifying a fact that
  // isn't currently on file (never-fabricate applies to freshness UI too).
  const ownerVerified = gym.verified || gym.owner_listed;
  const stampText =
    dayPass !== null && gym.day_pass_verified_at
      ? `${ownerVerified ? "Owner-verified" : "Updated"} ${relativeTime(gym.day_pass_verified_at)}`
      : null;
  const memberText =
    dayPass !== null && lastConfirmedAt ? `Confirmed by a member ${relativeTime(lastConfirmedAt)}` : null;

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

      {gym.members_guest_note && (
        <p className="mt-2.5 text-sm leading-relaxed text-ink/85">{gym.members_guest_note}</p>
      )}

      <div className="mt-3 space-y-1.5 border-t border-paper-line/60 pt-3">
        <PriceRow
          label="Day pass"
          amount={dayPass}
          // Only a fact we actually have earns a confirm control — an
          // "unlisted" row has nothing for a member to confirm.
          right={
            dayPass !== null ? (
              <FactConfirm gymId={gym.id} factType="price" factKey="day_pass" confirms={confirms} />
            ) : undefined
          }
        />
        <PriceRow label="Week pass" amount={weekPass} />
        {(stampText || memberText) && (
          <p className="font-mono pt-0.5 text-[10px] uppercase tracking-wide text-ink/45">
            {stampText}
            {stampText && memberText && <span className="mx-1 opacity-50">·</span>}
            {memberText}
          </p>
        )}
      </div>

      {gym.monthly_from !== null ? (
        <p
          className="mt-3 border-t border-paper-line/60 pt-3 text-sm text-ink"
          title={gym.monthly_note ?? undefined}
        >
          Memberships from{" "}
          <span className="font-mono font-semibold">
            ${formatPrice(Number(gym.monthly_from))}/mo
          </span>
        </p>
      ) : (
        gym.monthly_note && (
          // honest: many gyms don't publish a monthly rate — show what we DO
          // know (how to get it) rather than hiding the membership question
          <p className="mt-3 border-t border-paper-line/60 pt-3 text-sm leading-relaxed text-ink/80">
            <span className="text-ink/55">Memberships: </span>
            {gym.monthly_note}
          </p>
        )
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
