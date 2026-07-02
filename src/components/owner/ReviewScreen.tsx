"use client";

import { Pencil } from "lucide-react";
import { FORM_SECTIONS, visibleFields, type FieldDef } from "@/lib/owner/formConfig";
import { isAnswered, type AnswerMap, type FieldAnswer } from "@/lib/owner/answerTypes";
import { answerEquals } from "@/lib/owner/diff";
import type { GymSegment } from "@/lib/types/scout";

function describe(field: FieldDef, a: FieldAnswer | undefined): string {
  if (!a || !isAnswered(a)) return "unlisted";
  switch (a.kind) {
    case "chips":
      return a.value.map((k) => field.options?.find((o) => o.key === k)?.label ?? k).join(", ");
    case "choice":
      return field.options?.find((o) => o.key === a.value)?.label ?? a.value ?? "unlisted";
    case "tri":
      return a.value === true ? "Yes" : a.value === false ? "No" : "unlisted";
    case "num":
      return a.value != null ? `${field.type === "currency" ? "$" : ""}${a.value}${field.unit ? ` ${field.unit}` : ""}` : "unlisted";
    case "text":
      return a.value || "unlisted";
    case "hours":
      return "Hours set";
    case "plans":
      return `${a.value.filter((p) => p.name.trim() || p.prices.some((pr) => pr.monthly != null)).length} plan(s)`;
    case "photo":
      return "unlisted";
  }
}

/** True when the owner's current answer is unchanged from the prefilled
 *  (public-info) value — delegates to the shared kind-aware equality in
 *  diff.ts (the same gate the server uses; CLAUDE.md rule 5). */
function isPrefilled(a: FieldAnswer | undefined, p: FieldAnswer | undefined): boolean {
  return !!a && isAnswered(a) && answerEquals(a, p);
}

/** Final review before submit — every answer listed, blanks shown as "unlisted",
 *  so the owner catches a fat-fingered price before the owner-tier publish (I10). */
export function ReviewScreen({
  gymName,
  answers,
  prefill,
  segment,
  earned,
  error,
  onSubmit,
  onEdit,
}: {
  gymName: string;
  answers: AnswerMap;
  prefill: AnswerMap;
  segment: GymSegment | null;
  earned: boolean;
  error?: string | null;
  onSubmit: () => void;
  onEdit: (sectionId: string) => void;
}) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      <p className="readout text-pool-deep">Review &amp; submit</p>
      <h1 className="display mt-1 text-2xl text-ink sm:text-3xl">{gymName}</h1>
      <p className="mt-2 text-sm text-ink/60">
        Check it over — blanks show as &ldquo;unlisted&rdquo; (we never guess). Nothing publishes until you submit.
      </p>

      <div className="mt-6 space-y-3">
        {FORM_SECTIONS.map((section) => {
          const visible = visibleFields(section, segment, answers);
          const fields = visible.filter((f) => f.type !== "photo-stub");
          const answered = fields.filter((f) => isAnswered(answers[f.id]));
          // Surface uploaded photos so the owner can verify them before submit.
          const photos = visible
            .filter((f) => f.type === "photo-stub")
            .flatMap((f) => {
              const a = answers[f.id];
              return a?.kind === "photo" ? a.value : [];
            });
          const hasContent = answered.length > 0 || photos.length > 0;
          return (
            <div key={section.id} className="rounded-xl border border-paper-line bg-paper-raise p-4">
              <div className="flex items-center justify-between">
                <h2 className="readout text-ink/70">{section.label}</h2>
                <button
                  type="button"
                  onClick={() => onEdit(section.id)}
                  className="readout -m-1 inline-flex min-h-[36px] items-center gap-1 p-1 text-blaze-deep hover:underline"
                >
                  <Pencil className="h-3 w-3" aria-hidden /> Edit
                </button>
              </div>
              {!hasContent ? (
                <p className="mt-2 text-sm text-ink/40">Nothing entered — unlisted</p>
              ) : (
                <>
                  {answered.length > 0 && (
                    <dl className="mt-2 space-y-1.5">
                      {answered.map((f) => (
                        <div
                          key={f.id}
                          className="flex flex-col gap-0.5 text-sm sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                        >
                          <dt className="shrink-0 text-ink/55">{f.label}</dt>
                          <dd className="break-words text-ink sm:text-right">
                            {describe(f, answers[f.id])}
                            {isPrefilled(answers[f.id], prefill[f.id]) && (
                              <span className="ml-1.5 inline-flex items-center gap-1 align-middle text-[10px] uppercase tracking-wide text-pool-deep">
                                <span className="inline-block h-1.5 w-1.5 rounded-full bg-pool" aria-hidden /> from public info
                              </span>
                            )}
                          </dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  {photos.length > 0 && (
                    <div className="mt-3">
                      <p className="readout mb-1.5 text-ink/55">
                        {photos.length} photo{photos.length === 1 ? "" : "s"}
                      </p>
                      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                        {photos.map((p) => (
                          <div
                            key={p.path}
                            className="aspect-square overflow-hidden rounded-lg border border-paper-line bg-paper"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={p.url} alt={p.tag || "Gym photo"} className="h-full w-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-6 text-sm text-blaze-deep" role="alert">{error}</p>}

      <div className="mt-6 flex items-center justify-between">
        <button type="button" onClick={() => onEdit("A")} className="text-sm text-ink/55 hover:text-ink">
          ← Keep editing
        </button>
        <button
          type="button"
          onClick={onSubmit}
          className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink-raise"
        >
          {earned ? "Submit — Gym Verified" : "Submit listing"}
        </button>
      </div>
    </div>
  );
}
