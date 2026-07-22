/**
 * Display status for gym hours — "Open · closes 10 PM", "Closes soon",
 * "Opens 5 AM". Built ON TOP of the scorer's isOpenNow (single source of
 * open/closed truth); this module only adds the human phrasing.
 */
import { isOpenNow } from "./scoring/scorer";
import type { HoursMap } from "./types/scout";

const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;

function fmtClock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (h === 24 || (h === 0 && m === 0)) return "midnight";
  const hr = h % 12 === 0 ? 12 : h % 12;
  const suffix = h < 12 ? "AM" : "PM";
  return m ? `${hr}:${String(m).padStart(2, "0")} ${suffix}` : `${hr} ${suffix}`;
}

function parseClockMins(t: string, isClose = false): number | null {
  const s = (t ?? "").trim();
  if (!/^\d{1,2}(:\d{1,2})?$/.test(s)) return null;
  const [h, m] = s.split(":").map(Number);
  const total = h * 60 + (Number.isFinite(m) ? m : 0);
  return isClose && total === 0 ? 1440 : total;
}

export interface OpenStatus {
  open: boolean;
  /** e.g. "Open · closes 10 PM" · "Closes soon" · "Opens 5 AM" · "Hours not listed today" */
  label: string;
  /** True inside the final hour before close — the urgency case. */
  closingSoon: boolean;
}

/**
 * Minutes until close for a published [open, close] while the gym is open.
 * Overnight: wrap close +1440 when close <= open and we're still in the
 * evening stretch (mins >= open), or when close has already passed the
 * clock but isOpenNow still says open.
 */
function minutesUntilClose(
  opensAt: string,
  closesAt: string,
  mins: number,
): { minutesLeft: number; closesAt: string } | null {
  const openMins = parseClockMins(opensAt, false);
  let closeMins = parseClockMins(closesAt, true);
  if (openMins === null || closeMins === null) return null;

  if (closeMins <= openMins) {
    // Overnight range: evening stretch needs tomorrow's close.
    if (mins >= openMins) closeMins += 1440;
  } else if (closeMins <= mins) {
    // Open (per isOpenNow) but close already behind the clock — wrap.
    closeMins += 1440;
  }

  const minutesLeft = closeMins - mins;
  if (minutesLeft <= 0) return null;
  return { minutesLeft, closesAt };
}

/** If `now` is still inside yesterday's overnight window, return that close. */
function yesterdayOvernightClose(
  hours: HoursMap,
  dayIdx: number,
  mins: number,
): { minutesLeft: number; closesAt: string } | null {
  const yrange = hours[DAY_KEYS[(dayIdx + 6) % 7]];
  if (!yrange) return null;
  const openMins = parseClockMins(yrange[0], false);
  let closeMins = parseClockMins(yrange[1], true);
  if (openMins === null || closeMins === null) return null;
  // Overnight only, and still before yesterday's close this morning.
  if (closeMins > openMins) return null;
  if (mins >= closeMins) return null;
  return { minutesLeft: closeMins - mins, closesAt: yrange[1] };
}

export function openStatus(hours: HoursMap | null, now: Date = new Date()): OpenStatus | null {
  if (!hours) return null;
  if (hours.open_24h) return { open: true, label: "Open 24 hours", closingSoon: false };
  const open = isOpenNow(hours, now);
  const dayIdx = now.getDay();
  const today = hours[DAY_KEYS[dayIdx]];
  const mins = now.getHours() * 60 + now.getMinutes();

  if (open === true) {
    // Active close: yesterday's overnight carry-over wins when it applies
    // (sat 01:00 still under fri 17:00–02:00), else today's published range.
    const fromYday = yesterdayOvernightClose(hours, dayIdx, mins);
    const fromToday = today
      ? minutesUntilClose(today[0], today[1], mins)
      : null;
    const active = fromYday ?? fromToday;
    if (!active) {
      return { open: true, label: "Open", closingSoon: false };
    }
    const closingSoon = active.minutesLeft > 0 && active.minutesLeft <= 60;
    return {
      open: true,
      label: closingSoon
        ? `Closes soon · ${fmtClock(active.closesAt)}`
        : `Open · closes ${fmtClock(active.closesAt)}`,
      closingSoon,
    };
  }

  if (open === null && !today) {
    // Day absent from map: isOpenNow treats as unknown — never fabricate
    // "Closed today". Honest label + optional next-open hint.
    for (let i = 1; i <= 7; i++) {
      const d = DAY_KEYS[(dayIdx + i) % 7];
      const range = hours[d];
      if (range) {
        const dayName = i === 1 ? "tomorrow" : d[0].toUpperCase() + d.slice(1);
        return {
          open: false,
          label: `Hours not listed today · opens ${fmtClock(range[0])} ${dayName}`,
          closingSoon: false,
        };
      }
    }
    return {
      open: false,
      label: "Hours not listed today",
      closingSoon: false,
    };
  }

  // open===null with a range present today means isOpenNow couldn't parse the
  // tuple (blank/garbage) — honest "unknown", never a fabricated "Closed today".
  if (open === null || !today) return null;

  const [opensAt] = today;
  const openMins = parseClockMins(opensAt, false);
  const beforeOpen = openMins !== null && mins < openMins;
  return {
    open: false,
    label: beforeOpen ? `Opens ${fmtClock(opensAt)}` : "Closed for today",
    closingSoon: false,
  };
}
