/** Membership-vs-pass honesty math from the user's own visit log.
 *  Pure; no network. */
export interface NudgeResult {
  gymId: string;
  gymName: string;
  visitCount: number;
  spentEstimate: number;
  membershipFrom: number;
  message: string;
}

const TRAILING_DAYS = 30;
const VISIT_THRESHOLD = 3;

export function computeMembershipNudge(
  visits: Array<{ gym_id: string; visited_on: string }>,
  gym: {
    id: string;
    name: string;
    day_pass_price: number | null;
    monthly_from: number | null;
  },
  now: Date = new Date(),
): NudgeResult | null {
  if (gym.day_pass_price === null || gym.monthly_from === null) return null;
  const cutoff = new Date(now);
  cutoff.setDate(cutoff.getDate() - TRAILING_DAYS);
  const recent = visits.filter(
    (v) => v.gym_id === gym.id && new Date(`${v.visited_on}T12:00:00`) >= cutoff,
  );
  if (recent.length < VISIT_THRESHOLD) return null;
  const spent = recent.length * Number(gym.day_pass_price);
  if (spent <= Number(gym.monthly_from)) return null; // passes still winning
  return {
    gymId: gym.id,
    gymName: gym.name,
    visitCount: recent.length,
    spentEstimate: spent,
    membershipFrom: Number(gym.monthly_from),
    // Conditional, never a guaranteed-savings claim: Scout records visits, not
    // what the user actually paid (they may already be a member, or used a
    // trial/guest pass), and monthly_from ignores enrollment/annual fees.
    message: `${recent.length} ${gym.name} visits this month. If you paid the $${Number(gym.day_pass_price).toFixed(0)} day-pass each time, that's ≈ $${spent.toFixed(0)} — a membership starts at $${Number(gym.monthly_from).toFixed(2)}/mo. Worth comparing if you're paying per visit.`,
  };
}
