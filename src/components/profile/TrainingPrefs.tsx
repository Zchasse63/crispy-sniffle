"use client";

import { useEffect, useState } from "react";
import { Loader2, SlidersHorizontal } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import {
  SEGMENT_LABELS,
  VIBE_LABELS,
  VIBE_TAGS,
  type GymSegment,
  type VibeTag,
} from "@/lib/types/scout";

const SEGMENTS = Object.keys(SEGMENT_LABELS) as GymSegment[];

/** Training preferences — soft signals only. On your next sign-in they
 *  prefill the search as preferences (boost, never exclude). */
export function TrainingPrefs({ userId }: { userId: string }) {
  const [segments, setSegments] = useState<GymSegment[]>([]);
  const [vibes, setVibes] = useState<VibeTag[]>([]);
  const [state, setState] = useState<"loading" | "idle" | "saving" | "saved" | "error">("loading");

  useEffect(() => {
    getBrowserClient()
      .from("profiles")
      .select("training_prefs")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data }) => {
        const prefs = (data?.training_prefs ?? {}) as {
          segments?: GymSegment[];
          vibes?: VibeTag[];
        };
        setSegments(prefs.segments ?? []);
        setVibes(prefs.vibes ?? []);
        setState("idle");
      });
  }, [userId]);

  const save = async () => {
    setState("saving");
    const { error } = await getBrowserClient()
      .from("profiles")
      .upsert(
        { id: userId, training_prefs: { segments, vibes }, updated_at: new Date().toISOString() },
        { onConflict: "id" },
      );
    setState(error ? "error" : "saved");
  };

  const toggle = <T,>(list: T[], v: T): T[] =>
    list.includes(v) ? list.filter((x) => x !== v) : [...list, v];

  if (state === "loading") return <div className="skeleton mt-3 h-16 w-full rounded-lg" />;

  return (
    <section className="mt-5 rounded-xl border border-paper-line bg-paper-raise p-5">
      <h2 className="readout flex items-center gap-1.5 text-ink/65">
        <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden /> Training preferences
      </h2>
      <p className="mt-1.5 text-xs leading-relaxed text-ink/65">
        Soft preferences — they boost matching when you arrive, never hide gyms.
      </p>

      <p className="readout mt-3 text-ink/60">Gym types</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {SEGMENTS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={segments.includes(s)}
            onClick={() => {
              setSegments(toggle(segments, s));
              setState("idle");
            }}
            className={`font-mono rounded-md border px-2.5 py-1.5 text-[10.5px] uppercase tracking-wide transition-colors ${
              segments.includes(s)
                ? "border-ink bg-ink text-paper"
                : "border-paper-line bg-paper text-ink/75 hover:border-ink/40"
            }`}
          >
            {SEGMENT_LABELS[s]}
          </button>
        ))}
      </div>

      <p className="readout mt-4 text-ink/60">Vibes</p>
      <div className="mt-1.5 flex flex-wrap gap-1.5">
        {VIBE_TAGS.map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={vibes.includes(v)}
            onClick={() => {
              setVibes(toggle(vibes, v));
              setState("idle");
            }}
            className={`font-mono rounded-md border px-2.5 py-1.5 text-[10.5px] uppercase tracking-wide transition-colors ${
              vibes.includes(v)
                ? "border-pool-deep bg-pool-tint text-ink"
                : "border-paper-line bg-paper text-ink/75 hover:border-ink/40"
            }`}
          >
            {VIBE_LABELS[v]}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => void save()}
        disabled={state === "saving"}
        className="display mt-4 flex items-center gap-2 rounded-lg bg-blaze-deep px-4 py-2 text-xs tracking-wider text-white transition-colors hover:bg-blaze disabled:opacity-50"
      >
        {state === "saving" && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
        {state === "saved" ? "Saved ✓" : "Save preferences"}
      </button>
      {state === "error" && (
        <p className="mt-2 text-xs text-blaze-deep">
          Couldn&apos;t save — check your connection and try again.
        </p>
      )}
    </section>
  );
}
