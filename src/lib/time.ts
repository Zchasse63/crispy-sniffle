/**
 * Coarse relative-time formatter for freshness/trust stamps ("3w ago",
 * "2mo ago") — e.g. "owner-verified 3w ago", "confirmed by a member 2d ago".
 * Distinct from ResumeScreen's private minute-precision helper (built for
 * form-autosave feedback, not multi-week-old verification stamps). One
 * implementation for every "{tier} {time}" freshness surface — don't fork it.
 */
export function relativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "recently";
  const diffMs = Math.max(0, Date.now() - then);
  const mins = Math.round(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.round(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  const months = Math.round(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.round(days / 365);
  return `${years}y ago`;
}
