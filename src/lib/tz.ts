/**
 * A Date whose runtime-LOCAL calendar fields (getDay / getHours / getMinutes …)
 * equal the wall-clock time in `timeZone` at `instant`.
 *
 * The hours helpers (`isOpenNow`, `openStatus`) read local Date fields to decide
 * open/closed. Passing them `nowInZone(gym.timezone)` instead of a raw `new Date()`
 * makes them evaluate a gym's schedule in the GYM's timezone — not the viewer's
 * browser clock or the Netlify server's UTC clock — without changing their
 * signatures. Intl is DST-correct and needs no dependency. Falls back to the raw
 * instant when `timeZone` is missing or invalid (never throws).
 */
export function nowInZone(
  timeZone: string | null | undefined,
  instant: Date = new Date(),
): Date {
  if (!timeZone) return instant;
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
    }).formatToParts(instant);
    const field = (t: string) => Number(parts.find((x) => x.type === t)?.value);
    const y = field("year");
    const mo = field("month");
    const d = field("day");
    const h = field("hour") % 24; // h23 midnight can surface as 24 in some ICU builds
    const mi = field("minute");
    const s = field("second");
    if ([y, mo, d, h, mi, s].some((v) => !Number.isFinite(v))) return instant;
    return new Date(y, mo - 1, d, h, mi, s);
  } catch {
    return instant;
  }
}
