/**
 * Ask Scout's sentence templates — the ONLY place an Ask Scout verdict
 * becomes English. The LLM never generates this text (see
 * supabase/functions/ask-gym); it only returns fact ids, and the verdict is
 * derived server-side from DB rows. This registry maps fact-type × verdict
 * to a fixed sentence, optionally interpolating a fact's own label — never
 * anything the model wrote.
 *
 * Kept in this component-adjacent file (not lib/types/scout.ts) because it's
 * presentation copy, not a shared data contract — scout.ts's own doc comment
 * scopes it to exactly four named surfaces, and padding it with UI sentence
 * strings would blur that boundary.
 */
import type { AskVerdict, FactRef, GymEquipmentRecord, HoursMap } from "@/lib/types/scout";

export type FactKind = "amenity" | "equipment" | "parking" | "transit" | "gym_day_pass_price" | "gym_hours";

export function factKindOf(id: string): FactKind | null {
  if (id === "gym:day_pass_price") return "gym_day_pass_price";
  if (id === "gym:hours") return "gym_hours";
  const prefix = id.slice(0, id.indexOf(":"));
  if (prefix === "amenity" || prefix === "equipment" || prefix === "parking" || prefix === "transit") {
    return prefix;
  }
  return null;
}

export const CANNOT_ANSWER = "Couldn't answer that — the facts on this page are everything we have.";

type Sentence = (label: string) => string;
type NonTerminalVerdict = Exclude<AskVerdict, "cannot_answer">;

const SENTENCE: Record<FactKind, Partial<Record<NonTerminalVerdict, Sentence>>> = {
  amenity: {
    yes: (label) => `Yes — ${label} is available here.`,
    no: (label) => `No — ${label} isn't offered here.`,
    not_listed: (label) => `${label} isn't listed for this gym yet.`,
  },
  equipment: {
    yes: (label) => `Yes — this gym has ${label}.`,
    not_listed: (label) => `${label} isn't listed for this gym yet.`,
    // No "no" template: gym_equipment rows never record a confirmed absence
    // (existence of the row IS the fact) — structurally unreachable. If the
    // server ever somehow emitted it, renderAskSentence falls back to
    // CANNOT_ANSWER rather than fabricate copy for a state that can't occur.
  },
  parking: {
    yes: () => "Yes — here's what's on file for parking:",
    not_listed: () => "Parking isn't listed for this gym yet.",
  },
  transit: {
    yes: () => "Yes — here's what's on file nearby:",
    not_listed: () => "Transit info isn't listed for this gym yet.",
  },
  gym_day_pass_price: {
    yes: () => "Yes — day pass price is below.",
    not_listed: () => "Day pass pricing isn't listed for this gym yet.",
  },
  gym_hours: {
    // NEVER assert "yes, open Saturday" — the id scheme has no per-day
    // granularity (gym:hours is one scalar meaning "hours are on file at
    // all"), so the actual day-specific answer must come from the verbatim
    // hours rendered alongside this sentence, never asserted here.
    yes: () => "Here are the hours on file — check the day you asked about below.",
    not_listed: () => "Hours aren't listed for this gym yet.",
  },
};

/** Renders the ONE sentence for an Ask Scout answer, keyed off the first
 *  (highest-priority) factRef the server returned. */
export function renderAskSentence(verdict: AskVerdict, factRefs: FactRef[]): string {
  if (verdict === "cannot_answer" || factRefs.length === 0) return CANNOT_ANSWER;
  const kind = factKindOf(factRefs[0].id);
  const template = kind ? SENTENCE[kind][verdict as NonTerminalVerdict] : undefined;
  return template ? template(factRefs[0].label) : CANNOT_ANSWER;
}

/** Mirrors src/app/gym/[slug]/page.tsx's private equipmentValue() — that
 *  helper can't be imported here (it's an unexported function in a Server
 *  Component page file), so this is a deliberate, small, kept-in-sync copy
 *  scoped to Ask Scout's own rendering. */
export function formatEquipmentValue(e: Pick<GymEquipmentRecord, "quantity" | "max_weight_lbs" | "brand">): string | null {
  const parts: string[] = [];
  if (e.quantity && e.quantity > 1) parts.push(`${e.quantity}×`);
  if (e.max_weight_lbs) parts.push(`to ${e.max_weight_lbs} lbs`);
  if (e.brand) parts.push(e.brand);
  return parts.length > 0 ? parts.join(" · ") : null;
}

const HOURS_DAYS: { key: keyof HoursMap; label: string }[] = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

function formatClock(t: string): string {
  const [h, m] = t.split(":").map(Number);
  if (h === 24 || (h === 0 && m === 0)) return "Midnight";
  const am = h < 12;
  const hr = h % 12 === 0 ? 12 : h % 12;
  return `${hr}${m ? `:${String(m).padStart(2, "0")}` : ""} ${am ? "AM" : "PM"}`;
}

/** Compact "Day: range" lines for the gym:hours factRef — verbatim DB data,
 *  never a day-specific yes/no assertion (see gym_hours template above). */
export function formatHoursLines(hours: HoursMap): string[] {
  if (hours.open_24h) return ["Open 24 hours, every day"];
  return HOURS_DAYS.map(({ key, label }) => {
    const range = hours[key] as [string, string] | undefined;
    return `${label}: ${range ? `${formatClock(range[0])} – ${formatClock(range[1])}` : "Closed"}`;
  });
}
