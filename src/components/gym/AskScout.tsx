"use client";

import { useMemo, useRef, useState } from "react";
import { Loader2, Sparkles } from "lucide-react";
import {
  AMENITY_LABELS,
  EQUIPMENT_LABELS,
  deriveAskChips,
  type AskAnswer,
  type EnrichedGym,
  type FactRef,
} from "@/lib/types/scout";
import { askGym } from "@/lib/search/askGym";
import { getBrowserClient } from "@/lib/supabase/browser";
import { formatPrice } from "@/lib/access";
import { parkingHeadline } from "@/lib/parking";
import { ProvenanceBadge } from "./ProvenanceBadge";
import { CANNOT_ANSWER, factKindOf, formatEquipmentValue, formatHoursLines, renderAskSentence } from "./askTemplates";

const QUESTION_CAP = 300;

/** Plain-text treatment for the two gym scalars (day_pass_price, hours) —
 *  they have no per-fact provenance column, so a ProvenanceBadge (which
 *  requires a real ProvenanceSource) is never fabricated for them. This
 *  mirrors the "Scout Data" wording used in the page's own About-this-data
 *  card, without invoking a badge component neither DropInCard nor
 *  HoursDisplay uses for these fields either. */
function ScoutDataTag() {
  return (
    <span className="readout inline-flex items-center rounded border border-paper-line px-1.5 py-0.5 text-ink/55">
      Scout Data
    </span>
  );
}

/** One cited fact, rendered from the gym's OWN prop data (not the edge
 *  function's copy) so the badge is byte-identical to every other section on
 *  the page — the factRef's id is only used to look the row back up. */
function FactRefRow({ gym, factRef }: { gym: EnrichedGym; factRef: FactRef }) {
  const kind = factKindOf(factRef.id);
  const rest = factRef.id.slice(factRef.id.indexOf(":") + 1);

  if (kind === "gym_day_pass_price") {
    return (
      <li className="flex items-center justify-between gap-2 text-sm text-ink">
        <span className="text-ink/70">Day pass price</span>
        <span className="flex items-center gap-2">
          <span className="font-mono font-semibold">
            {gym.day_pass_price !== null ? `$${formatPrice(Number(gym.day_pass_price))}` : "unlisted"}
          </span>
          <ScoutDataTag />
        </span>
      </li>
    );
  }

  if (kind === "gym_hours") {
    return (
      <li className="text-sm text-ink">
        <div className="flex items-center justify-between gap-2">
          <span className="text-ink/70">Hours</span>
          <ScoutDataTag />
        </div>
        {gym.hours && (
          <ul className="font-mono mt-1 space-y-0.5 text-[11px] uppercase tracking-wide text-ink/65">
            {formatHoursLines(gym.hours).map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        )}
      </li>
    );
  }

  if (kind === "amenity") {
    const row = gym.amenities.find((a) => a.amenity_key === rest);
    if (!row) return null;
    // The verdict sentence already says yes/no — this row's job is to name
    // AND source the fact, not re-derive present/absent from a badge alone,
    // so a stated absence never reads identically to a stated presence.
    return (
      <li className={`flex items-center justify-between gap-2 text-sm text-ink ${row.present ? "" : "opacity-60"}`}>
        <span>
          {AMENITY_LABELS[row.amenity_key] ?? row.amenity_key}
          {!row.present && <span className="ml-1.5 text-xs text-ink/50">— not offered</span>}
        </span>
        <ProvenanceBadge source={row.source} confidence={row.confidence} detail={row.detail} />
      </li>
    );
  }

  if (kind === "equipment") {
    const row = gym.equipment.find((e) => e.equipment_key === rest);
    if (!row) return null;
    const value = formatEquipmentValue(row);
    return (
      <li className="flex items-center justify-between gap-2 text-sm text-ink">
        <span>
          {EQUIPMENT_LABELS[row.equipment_key] ?? row.equipment_key}
          {value && (
            <span className="font-mono ml-2 text-xs uppercase tracking-wide text-ink/75">{value}</span>
          )}
        </span>
        <ProvenanceBadge source={row.source} confidence={row.confidence} detail={row.detail} />
      </li>
    );
  }

  if (kind === "parking") {
    const row = gym.parking.find((p) => p.id === rest);
    if (!row) return null;
    return (
      <li className="flex items-center justify-between gap-2 text-sm text-ink">
        <span>{parkingHeadline(row)}</span>
        <ProvenanceBadge source={row.source} confidence={row.confidence} detail={row.detail} />
      </li>
    );
  }

  if (kind === "transit") {
    const row = gym.transit.find((t) => t.id === rest);
    if (!row) return null;
    return (
      <li className="flex items-center justify-between gap-2 text-sm text-ink">
        <span>{row.name ?? "Transit"}</span>
        <ProvenanceBadge source={row.source} confidence={row.confidence} detail={row.detail} />
      </li>
    );
  }

  return null;
}

/**
 * Ask Scout — guardrailed gym Q&A card. Mounts below the equipment sections
 * on the gym detail page. Every answer is either a deterministic verdict
 * sentence built from facts this gym's page already shows, or an honest
 * "couldn't answer" — never local fallback text, never LLM prose (see
 * supabase/functions/ask-gym + askTemplates.ts).
 */
export function AskScout({ gym }: { gym: EnrichedGym }) {
  const chips = useMemo(() => deriveAskChips(gym), [gym]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [askedOnce, setAskedOnce] = useState(false);
  const [answer, setAnswer] = useState<AskAnswer | null>(null);
  const [failed, setFailed] = useState(false);
  const lastLogged = useRef<string>("");

  async function ask(raw: string) {
    const trimmed = raw.trim().slice(0, QUESTION_CAP);
    if (!trimmed || loading) return;
    setLoading(true);
    setAskedOnce(true);
    setFailed(false);
    setAnswer(null);
    const result = await askGym(gym.id, trimmed);
    setLoading(false);
    setAnswer(result);
    setFailed(result === null);

    // Fire-and-forget telemetry — mirrors the search_logs idiom in
    // DiscoveryClient: what people ask IS the product signal. Logs both
    // successful and failed/cannot-answer queries (verdict null on failure).
    if (trimmed !== lastLogged.current) {
      lastLogged.current = trimmed;
      void getBrowserClient()
        .from("ask_logs")
        .insert({
          gym_id: gym.id,
          question: trimmed,
          verdict: result?.verdict ?? null,
          fact_ids: result?.factRefs.map((f) => f.id) ?? [],
        })
        .then(undefined, () => {});
    }
  }

  const showCannotAnswer = askedOnce && !loading && (failed || !answer || answer.verdict === "cannot_answer");
  const showAnswer = askedOnce && !loading && !failed && answer && answer.verdict !== "cannot_answer";

  return (
    <section className="rounded-xl border border-paper-line bg-paper-raise p-5">
      <h2 className="readout flex items-center gap-1.5 text-ink/65">
        <Sparkles className="h-3.5 w-3.5" aria-hidden /> Ask Scout
      </h2>
      <p className="font-mono mt-1 text-[10px] uppercase tracking-wide text-ink/45">
        AI · answers only from verified facts
      </p>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <button
              key={chip.question}
              type="button"
              disabled={loading}
              onClick={() => void ask(chip.question)}
              className="font-mono rounded-full border border-paper-line bg-paper px-3 py-1.5 text-[11px] uppercase tracking-wide text-ink/75 transition-colors hover:border-ink/30 disabled:opacity-50"
            >
              {chip.label}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void ask(question);
        }}
        className="mt-3 flex gap-2"
      >
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value.slice(0, QUESTION_CAP))}
          placeholder="Ask about this gym…"
          maxLength={QUESTION_CAP}
          aria-label="Ask Scout a question about this gym"
          className="w-full rounded-md border border-paper-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink/40 focus:border-ink/40 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || question.trim().length === 0}
          className="font-mono shrink-0 rounded-md bg-ink px-3 py-2 text-xs uppercase tracking-wide text-paper transition-colors hover:bg-ink-raise disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Ask"}
        </button>
      </form>

      {askedOnce && (
        <div className="mt-3 border-t border-paper-line/60 pt-3">
          {loading ? (
            <p className="text-sm text-ink/60">Checking the facts on file…</p>
          ) : showCannotAnswer ? (
            <p className="text-sm text-ink/70">{CANNOT_ANSWER}</p>
          ) : showAnswer && answer ? (
            <div className="space-y-2.5">
              <p className="text-sm text-ink">{renderAskSentence(answer.verdict, answer.factRefs)}</p>
              {answer.factRefs.length > 0 && (
                <ul className="space-y-2">
                  {answer.factRefs.map((f) => (
                    <FactRefRow key={f.id} gym={gym} factRef={f} />
                  ))}
                </ul>
              )}
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
