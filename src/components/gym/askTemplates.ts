/**
 * Ask Scout's sentence templates — the ONLY place an Ask Scout verdict
 * becomes English. The LLM never generates this text (see
 * supabase/functions/ask-gym); it only returns fact ids + an intent
 * classification, and the verdict is derived server-side from DB rows (plus
 * a real numeric comparison for "compare" questions, also server-side). This
 * registry maps fact-type × verdict to a fixed sentence, optionally
 * interpolating a fact's own label/value — never anything the model wrote.
 * A compound (multi-fact) answer goes through renderCompoundSentence below,
 * which re-derives each fact's own true status from the gym prop so a mixed
 * "pool and sauna" (yes + no) answer can honestly name both parts instead of
 * silently dropping the one that disagrees with the aggregate verdict.
 *
 * Kept in this component-adjacent file (not lib/types/scout.ts) because it's
 * presentation copy, not a shared data contract — scout.ts's own doc comment
 * scopes it to exactly four named surfaces, and padding it with UI sentence
 * strings would blur that boundary.
 */
import type { AskVerdict, EnrichedGym, FactRef, GymEquipmentRecord, HoursMap } from "@/lib/types/scout";

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

type Sentence = (ref: FactRef) => string;
type NonTerminalVerdict = Exclude<AskVerdict, "cannot_answer">;

const SENTENCE: Record<FactKind, Partial<Record<NonTerminalVerdict, Sentence>>> = {
  amenity: {
    yes: (ref) => `Yes — ${ref.label} is available here.`,
    no: (ref) => `No — ${ref.label} isn't offered here.`,
    not_listed: (ref) => `${ref.label} isn't listed for this gym yet.`,
  },
  equipment: {
    yes: (ref) => `Yes — this gym has ${ref.label}.`,
    not_listed: (ref) => `${ref.label} isn't listed for this gym yet.`,
    // No "no" template: gym_equipment rows never record a confirmed absence
    // (existence of the row IS the fact), and compare-intent (the one path
    // that CAN produce a real "no") is scoped server-side to gym:day_pass_price
    // only — "no" is structurally unreachable here. If the server ever
    // somehow emitted it, renderAskSentence falls back to CANNOT_ANSWER
    // rather than fabricate copy for a state that can't occur.
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
    // Reachable from TWO different questions now: a plain existence check
    // ("do they sell day passes?") and a compare check ("is it under $20?").
    // Worded neutrally so it's honest either way — the actual number is
    // never restated here, only in the FactRefRow rendered below, so this
    // sentence can't drift out of sync with it.
    yes: () => "Yes — see the day pass price on file below.",
    // Only reachable via a "compare" question that failed (e.g. asked
    // "under $20" on a $25 gym) — gym:day_pass_price otherwise never
    // resolves "no".
    no: () => "No — the day pass price on file doesn't match that. See below.",
    not_listed: () => "Day pass pricing isn't listed for this gym yet.",
  },
  gym_hours: {
    // NEVER assert "yes, open Saturday" — the id scheme has no per-day
    // granularity (gym:hours is one scalar meaning "hours are on file at
    // all"), so the actual day-specific answer must come from the verbatim
    // hours rendered alongside this sentence, never asserted here. This
    // holds even for "open_on" (day/hours) questions.
    yes: () => "Here are the hours on file — check the day you asked about below.",
    not_listed: () => "Hours aren't listed for this gym yet.",
  },
};

/** True per-fact status (yes/no/not_listed), RE-DERIVED from the same
 *  EnrichedGym prop the rest of the page already treats as ground truth —
 *  never from anything the model said. Needed only for compound answers,
 *  where the single top-level verdict can legitimately disagree with one
 *  individual factRef's own status (e.g. "pool and sauna" with pool=yes,
 *  sauna=no resolves an overall "no" — this lets the sentence still name
 *  pool as a yes instead of implying both failed). */
function statusOfRef(ref: FactRef, gym: EnrichedGym): "yes" | "no" | "not_listed" {
  const kind = factKindOf(ref.id);
  const key = ref.id.slice(ref.id.indexOf(":") + 1);
  if (kind === "amenity") {
    const row = gym.amenities.find((a) => a.amenity_key === key);
    return row ? (row.present ? "yes" : "no") : "not_listed";
  }
  if (kind === "equipment") return gym.equipment.some((e) => e.equipment_key === key) ? "yes" : "not_listed";
  if (kind === "parking") return gym.parking.some((p) => p.id === key) ? "yes" : "not_listed";
  if (kind === "transit") return gym.transit.some((t) => t.id === key) ? "yes" : "not_listed";
  if (kind === "gym_day_pass_price") return gym.day_pass_price !== null ? "yes" : "not_listed";
  if (kind === "gym_hours") return gym.hours !== null ? "yes" : "not_listed";
  return "not_listed";
}

function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels[0] ?? "";
  if (labels.length === 2) return `${labels[0]} and ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")}, and ${labels[labels.length - 1]}`;
}

/** Compound (multi-fact) sentence. The server sends every referenced fact
 *  whenever an "all" (AND) question resolves a mix of statuses, specifically
 *  so this can name BOTH the yes and the no parts — never drops the failing
 *  conjunct, and never drops the passing one either (see deriveAnswer's
 *  "all" branch in supabase/functions/ask-gym/index.ts). Also handles the
 *  (rarer) case of an "exists"/"or" question where more than one referenced
 *  fact shares the winning verdict. */
function renderCompoundSentence(factRefs: FactRef[], gym: EnrichedGym): string {
  const parts = factRefs.map((ref) => ({ label: ref.label, status: statusOfRef(ref, gym) }));
  if (parts.every((p) => p.status === "yes")) {
    return `Yes — this gym has ${joinLabels(parts.map((p) => p.label))}.`;
  }
  if (parts.every((p) => p.status === "not_listed")) {
    const verb = parts.length > 1 ? "aren't" : "isn't";
    return `${joinLabels(parts.map((p) => p.label))} ${verb} listed for this gym yet.`;
  }
  // A genuine mix — name every part honestly rather than collapsing to one
  // verdict word.
  return parts
    .map((p) =>
      p.status === "yes" ? `Yes on ${p.label}` : p.status === "no" ? `No on ${p.label}` : `${p.label} isn't listed`,
    )
    .join(". ") + ".";
}

/** Renders the ONE sentence for an Ask Scout answer. A single factRef uses
 *  its own fact-kind template; 2+ factRefs (a compound "all"/AND question,
 *  or an "or" question that matched more than one fact) go through the
 *  compound renderer, which re-derives each fact's TRUE status from `gym`
 *  so a mixed answer can honestly name every part. */
export function renderAskSentence(verdict: AskVerdict, factRefs: FactRef[], gym: EnrichedGym): string {
  if (verdict === "cannot_answer" || factRefs.length === 0) return CANNOT_ANSWER;
  if (factRefs.length > 1) return renderCompoundSentence(factRefs, gym);
  const kind = factKindOf(factRefs[0].id);
  const template = kind ? SENTENCE[kind][verdict as NonTerminalVerdict] : undefined;
  return template ? template(factRefs[0]) : CANNOT_ANSWER;
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
    // Missing day key = unknown (pipeline may have dropped a day), not a
    // confirmed closed — never-fabricate. Matches openStatus phrasing.
    return `${label}: ${range ? `${formatClock(range[0])} – ${formatClock(range[1])}` : "Hours not listed"}`;
  });
}
