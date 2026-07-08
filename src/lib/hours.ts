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

export interface OpenStatus {
  open: boolean;
  /** e.g. "Open · closes 10 PM" · "Closes soon" · "Opens 5 AM" · "Closed today" */
  label: string;
  /** True inside the final hour before close — the urgency case. */
  closingSoon: boolean;
}

export function openStatus(hours: HoursMap | null, now: Date = new Date()): OpenStatus | null {
  if (!hours) return null;
  if (hours.open_24h) return { open: true, label: "Open 24 hours", closingSoon: false };
  const open = isOpenNow(hours, now);
  const today = hours[DAY_KEYS[now.getDay()]];
  if (open === null && !today) {
    // no range published for today — find the next day that opens
    for (let i = 1; i <= 7; i++) {
      const d = DAY_KEYS[(now.getDay() + i) % 7];
      const range = hours[d];
      if (range) {
        const dayName = i === 1 ? "tomorrow" : d[0].toUpperCase() + d.slice(1);
        return {
          open: false,
          label: `Closed today · opens ${fmtClock(range[0])} ${dayName}`,
          closingSoon: false,
        };
      }
    }
    return null;
  }
  // open===null with a range present today means isOpenNow couldn't parse the
  // tuple (blank/garbage) — honest "unknown", never a fabricated "Closed today".
  if (open === null || !today) return null;
  const [opensAt, closesAt] = today;
  if (open) {
    const mins = now.getHours() * 60 + now.getMinutes();
    const [ch, cm] = closesAt.split(":").map(Number);
    const closeMins = ch * 60 + (cm || 0) === 0 ? 1440 : ch * 60 + (cm || 0);
    const minutesLeft = closeMins - mins;
    const closingSoon = minutesLeft > 0 && minutesLeft <= 60;
    return {
      open: true,
      label: closingSoon
        ? `Closes soon · ${fmtClock(closesAt)}`
        : `Open · closes ${fmtClock(closesAt)}`,
      closingSoon,
    };
  }
  const mins = now.getHours() * 60 + now.getMinutes();
  const [oh, om] = opensAt.split(":").map(Number);
  const beforeOpen = mins < oh * 60 + (om || 0);
  return {
    open: false,
    label: beforeOpen ? `Opens ${fmtClock(opensAt)}` : "Closed for today",
    closingSoon: false,
  };
}
