"use client";

import { Plus, Trash2 } from "lucide-react";
import type { PlanDraft } from "@/lib/owner/answerTypes";
import type { CommitmentTerm, MembershipUsageType } from "@/lib/types/scout";

/** The price grid captures the common 3 commitment columns. Owners with other
 *  terms use the "Anything else about pricing?" note. */
const TERMS: { key: CommitmentTerm; label: string }[] = [
  { key: "month_to_month", label: "Monthly" },
  { key: "6_month", label: "6-mo" },
  { key: "12_month", label: "Annual" },
];

const USAGE: { key: MembershipUsageType; label: string }[] = [
  { key: "unlimited", label: "Unlimited" },
  { key: "visits_per_month", label: "Visits / month" },
  { key: "visits_per_week", label: "Visits / week" },
  { key: "classes_per_month", label: "Classes / month" },
];

const blankPlan = (): PlanDraft => ({
  name: "",
  usageType: null,
  usageCount: null,
  prices: TERMS.map((t) => ({ term: t.key, monthly: null })),
});

export function MembershipPlansField({
  value,
  onChange,
}: {
  value: PlanDraft[];
  onChange: (next: PlanDraft[]) => void;
}) {
  const patch = (i: number, p: Partial<PlanDraft>) =>
    onChange(value.map((plan, idx) => (idx === i ? { ...plan, ...p } : plan)));

  const setPrice = (i: number, term: CommitmentTerm, monthly: number | null) =>
    patch(i, {
      prices: TERMS.map((t) => {
        const existing = value[i].prices.find((pr) => pr.term === t.key);
        return t.key === term ? { term: t.key, monthly } : (existing ?? { term: t.key, monthly: null });
      }),
    });

  return (
    <div className="space-y-3">
      {value.map((plan, i) => (
        <div key={i} className="rounded-xl border border-paper-line bg-paper p-4">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={plan.name}
              placeholder={`Plan ${i + 1} name (e.g. "Unlimited", "8x/month")`}
              onChange={(e) => patch(i, { name: e.target.value })}
              className="flex-1 rounded-lg border border-paper-line bg-paper-raise px-3 py-1.5 text-sm text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none"
            />
            <button
              type="button"
              onClick={() => onChange(value.filter((_, idx) => idx !== i))}
              className="flex h-8 w-8 items-center justify-center rounded text-ink/40 hover:bg-blaze-tint hover:text-blaze-deep"
              aria-label="Remove plan"
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </button>
          </div>

          {/* usage */}
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {USAGE.map((u) => {
              const active = plan.usageType === u.key;
              return (
                <button
                  key={u.key}
                  type="button"
                  onClick={() => patch(i, { usageType: active ? null : u.key, usageCount: u.key === "unlimited" ? null : plan.usageCount })}
                  className={`rounded-full border px-2.5 py-1 text-[12px] transition-colors ${
                    active ? "border-ink bg-ink text-paper" : "border-contour-deep/50 bg-paper-raise text-ink/75 hover:border-ink/40"
                  }`}
                >
                  {u.label}
                </button>
              );
            })}
            {plan.usageType && plan.usageType !== "unlimited" && (
              <input
                type="number"
                min={1}
                value={plan.usageCount ?? ""}
                placeholder="#"
                onChange={(e) => patch(i, { usageCount: e.target.value === "" ? null : Number(e.target.value) })}
                className="font-mono w-16 rounded border border-paper-line bg-paper-raise px-2 py-1 text-xs text-ink focus:border-ink/40 focus:outline-none"
              />
            )}
          </div>

          {/* price by term */}
          <div className="mt-3 grid grid-cols-3 gap-2">
            {TERMS.map((t) => {
              const price = plan.prices.find((pr) => pr.term === t.key)?.monthly ?? null;
              return (
                <label key={t.key} className="block">
                  <span className="readout mb-1 block text-ink/45">{t.label}</span>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-2 top-1/2 -translate-y-1/2 font-mono text-xs text-ink/45">$</span>
                    <input
                      type="number"
                      min={0}
                      value={price ?? ""}
                      placeholder="—"
                      onChange={(e) => {
                        const v = e.target.value;
                        const n = v === "" ? null : Number(v);
                        setPrice(i, t.key, n != null && Number.isFinite(n) && n >= 0 ? n : null);
                      }}
                      className="font-mono w-full rounded border border-paper-line bg-paper-raise py-1.5 pl-5 pr-2 text-xs text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none"
                    />
                  </div>
                </label>
              );
            })}
          </div>
          <p className="readout mt-1.5 text-ink/35">/ month at each commitment length</p>
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...value, blankPlan()])}
        className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-contour-deep/50 px-3 py-2 text-[13px] text-ink/70 hover:border-ink/40 hover:text-ink"
      >
        <Plus className="h-4 w-4" aria-hidden /> Add a membership plan
      </button>
    </div>
  );
}
