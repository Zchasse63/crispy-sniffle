"use client";

import type { AnswerMap, FieldAnswer, TriState } from "@/lib/owner/answerTypes";
import { visibleFields, type FieldDef, type FormSection } from "@/lib/owner/formConfig";
import type { GymSegment, HoursMap } from "@/lib/types/scout";
import { ChipMulti } from "./fields/ChipMulti";
import { ChipSingle } from "./fields/ChipSingle";
import { TriStateToggle } from "./fields/TriStateToggle";
import { CurrencyInput } from "./fields/CurrencyInput";
import { StepperField } from "./fields/StepperField";
import { HoursGrid } from "./fields/HoursGrid";
import { PhotoUpload } from "./fields/PhotoUpload";
import { MembershipPlansField } from "./fields/MembershipPlansField";
import { DictationMic } from "./DictationMic";

export function SectionRenderer({
  section,
  answers,
  prefill,
  segment,
  token,
  onPatch,
  onAppendText,
}: {
  section: FormSection;
  answers: AnswerMap;
  prefill: AnswerMap;
  segment: GymSegment | null;
  token: string;
  onPatch: (fieldId: string, answer: FieldAnswer) => void;
  onAppendText: (fieldId: string, text: string) => void;
}) {
  const fields = visibleFields(section, segment, answers);

  return (
    <div className="space-y-7">
      {section.intro && <p className="text-sm leading-relaxed text-ink/60">{section.intro}</p>}
      {fields.map((field) => {
        // text/currency have a single focusable control → real <label htmlFor>.
        // chip/toggle/stepper/hours groups aren't a single control → plain heading.
        const single = field.type === "text" || field.type === "text-voice" || field.type === "currency";
        const labelCls = "mb-2.5 block text-[15px] font-medium text-ink";
        return (
          <div key={field.id}>
            {single ? (
              <label htmlFor={field.id} className={labelCls}>
                {field.label}
              </label>
            ) : (
              <p className={labelCls}>{field.label}</p>
            )}
            {field.hint && <p className="-mt-1.5 mb-2.5 text-xs text-ink/50">{field.hint}</p>}
            <Widget
              field={field}
              answers={answers}
              prefill={prefill}
              token={token}
              onPatch={onPatch}
              onAppendText={onAppendText}
            />
          </div>
        );
      })}
    </div>
  );
}

function Widget({
  field,
  answers,
  prefill,
  token,
  onPatch,
  onAppendText,
}: {
  field: FieldDef;
  answers: AnswerMap;
  prefill: AnswerMap;
  token: string;
  onPatch: (fieldId: string, answer: FieldAnswer) => void;
  onAppendText: (fieldId: string, text: string) => void;
}) {
  const a = answers[field.id];
  const p = prefill[field.id];

  switch (field.type) {
    case "chip-multi": {
      const value = a?.kind === "chips" ? a.value : [];
      const prefillSelected = p?.kind === "chips" ? p.value : [];
      return (
        <ChipMulti
          options={field.options ?? []}
          value={value}
          prefillSelected={prefillSelected}
          maxSelect={field.maxSelect}
          onChange={(next) => onPatch(field.id, { kind: "chips", value: next })}
        />
      );
    }
    case "chip-single": {
      const value = a?.kind === "choice" ? a.value : null;
      const prefillValue = p?.kind === "choice" ? p.value : null;
      return (
        <ChipSingle
          options={field.options ?? []}
          value={value}
          prefillValue={prefillValue}
          onChange={(next) => onPatch(field.id, { kind: "choice", value: next })}
        />
      );
    }
    case "tri-state": {
      const value: TriState = a?.kind === "tri" ? a.value : null;
      return <TriStateToggle value={value} onChange={(v) => onPatch(field.id, { kind: "tri", value: v })} />;
    }
    case "stepper": {
      const value = a?.kind === "num" ? a.value : null;
      return (
        <StepperField
          value={value}
          min={field.min}
          max={field.max}
          step={field.step}
          unit={field.unit}
          onChange={(v) => onPatch(field.id, { kind: "num", value: v })}
        />
      );
    }
    case "currency": {
      const value = a?.kind === "num" ? a.value : null;
      const prefilled = p?.kind === "num" && p.value != null;
      return (
        <CurrencyInput
          id={field.id}
          value={value}
          prefilled={prefilled}
          placeholder={field.placeholder}
          onChange={(v) => onPatch(field.id, { kind: "num", value: v })}
        />
      );
    }
    case "text": {
      const value = a?.kind === "text" ? a.value : "";
      const inputType =
        field.format === "email" ? "email" : field.format === "url" ? "url" : field.format === "tel" ? "tel" : "text";
      return (
        <input
          id={field.id}
          type={inputType}
          inputMode={field.format === "tel" ? "tel" : field.format === "email" ? "email" : field.format === "url" ? "url" : undefined}
          value={value}
          placeholder={field.placeholder}
          onChange={(e) => onPatch(field.id, { kind: "text", value: e.target.value })}
          onBlur={(e) => {
            // light, non-blocking normalization: prepend https:// to a bare domain
            if (field.format === "url") {
              const v = e.target.value.trim();
              if (v && !/^https?:\/\//i.test(v) && /\.[a-z]{2,}/i.test(v)) {
                onPatch(field.id, { kind: "text", value: `https://${v}` });
              }
            }
          }}
          className="w-full max-w-md rounded-lg border border-paper-line bg-paper-raise px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none"
        />
      );
    }
    case "text-voice": {
      const value = a?.kind === "text" ? a.value : "";
      return (
        <div className="space-y-2.5">
          <textarea
            id={field.id}
            value={value}
            placeholder={field.placeholder}
            rows={field.large ? 5 : 3}
            onChange={(e) => onPatch(field.id, { kind: "text", value: e.target.value })}
            className="w-full rounded-lg border border-paper-line bg-paper-raise px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none"
          />
          <DictationMic onAppend={(text) => onAppendText(field.id, text)} />
        </div>
      );
    }
    case "hours-grid": {
      const value: HoursMap | null = a?.kind === "hours" ? a.value : null;
      return <HoursGrid value={value} onChange={(v) => onPatch(field.id, { kind: "hours", value: v })} />;
    }
    case "membership-plans": {
      const value = a?.kind === "plans" ? a.value : [];
      return (
        <MembershipPlansField
          value={value}
          onChange={(v) => onPatch(field.id, { kind: "plans", value: v })}
        />
      );
    }
    case "photo-stub": {
      const value = a?.kind === "photo" ? a.value : [];
      const rights = answers["i_photo_rights"];
      const rightsAffirmed = rights?.kind === "tri" && rights.value === true;
      return (
        <PhotoUpload
          token={token}
          value={value}
          rightsAffirmed={rightsAffirmed}
          onAffirmRights={(v) => onPatch("i_photo_rights", { kind: "tri", value: v })}
          onChange={(v) => {
            onPatch(field.id, { kind: "photo", value: v });
            // Clearing every photo drops the rights affirmation, so a fresh batch
            // with different provenance must be re-attested (the box re-enables).
            if (v.length === 0) onPatch("i_photo_rights", { kind: "tri", value: null });
          }}
        />
      );
    }
  }
}
