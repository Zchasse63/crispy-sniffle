"use client";

import { Pencil } from "lucide-react";
import { FORM_SECTIONS, visibleFields, type FieldDef } from "@/lib/owner/formConfig";
import { isAnswered, type AnswerMap, type FieldAnswer } from "@/lib/owner/answerTypes";
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

/** Final review before submit — every answer listed, blanks shown as "unlisted",
 *  so the owner catches a fat-fingered price before the owner-tier publish (I10). */
export function ReviewScreen({
  gymName,
  answers,
  segment,
  earned,
  onSubmit,
  onEdit,
}: {
  gymName: string;
  answers: AnswerMap;
  segment: GymSegment | null;
  earned: boolean;
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
          const fields = visibleFields(section, segment, answers).filter((f) => f.type !== "photo-stub");
          const answered = fields.filter((f) => isAnswered(answers[f.id]));
          return (
            <div key={section.id} className="rounded-xl border border-paper-line bg-paper-raise p-4">
              <div className="flex items-center justify-between">
                <h2 className="readout text-ink/70">{section.label}</h2>
                <button
                  type="button"
                  onClick={() => onEdit(section.id)}
                  className="readout inline-flex items-center gap-1 text-blaze-deep hover:underline"
                >
                  <Pencil className="h-3 w-3" aria-hidden /> Edit
                </button>
              </div>
              {answered.length === 0 ? (
                <p className="mt-2 text-sm text-ink/40">Nothing entered — unlisted</p>
              ) : (
                <dl className="mt-2 space-y-1.5">
                  {answered.map((f) => (
                    <div key={f.id} className="flex justify-between gap-4 text-sm">
                      <dt className="shrink-0 text-ink/55">{f.label}</dt>
                      <dd className="truncate text-right text-ink">{describe(f, answers[f.id])}</dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          );
        })}
      </div>

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
