/**
 * Ask Scout — gym-scoped Q&A orchestration. Mirrors lib/search/aiSearch.ts's
 * client orchestration idiom (same header names, same publishable key, same
 * defensive sanitize-before-use discipline). UNLIKE aiSearch.ts, there is NO
 * local fallback here: any failure (network, timeout, non-2xx, malformed
 * JSON, invalid verdict) returns null and the whole feature hides — Scout
 * never fabricates an answer client-side when the edge function is down.
 */
import type { AskAnswer, AskVerdict, FactRef } from "@/lib/types/scout";

const VALID_VERDICTS: readonly AskVerdict[] = ["yes", "no", "not_listed", "cannot_answer"];
const QUESTION_CAP = 300;

function sanitizeFactRef(raw: unknown): FactRef | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string" || typeof r.label !== "string") return null;
  return {
    id: r.id,
    label: r.label,
    value: typeof r.value === "string" ? r.value : null,
    source: typeof r.source === "string" ? (r.source as FactRef["source"]) : null,
    confidence: typeof r.confidence === "number" ? r.confidence : null,
    detail: typeof r.detail === "string" ? r.detail : null,
  };
}

function sanitize(raw: unknown): AskAnswer | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.verdict !== "string" || !VALID_VERDICTS.includes(r.verdict as AskVerdict)) return null;
  const factRefs = (Array.isArray(r.factRefs) ? r.factRefs : [])
    .map(sanitizeFactRef)
    .filter((f): f is FactRef => f !== null);
  return { verdict: r.verdict as AskVerdict, factRefs };
}

/**
 * @returns null on ANY failure — no local fallback. Callers must treat null
 *   as "hide the answer", never as a default/empty answer to render.
 */
export async function askGym(gymId: string, question: string): Promise<AskAnswer | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  const trimmed = question.trim().slice(0, QUESTION_CAP);
  if (!trimmed) return null;

  try {
    const res = await fetch(`${url}/functions/v1/ask-gym`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({ gymId, question: trimmed }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { answer?: unknown };
    return sanitize(data.answer);
  } catch {
    return null;
  }
}
