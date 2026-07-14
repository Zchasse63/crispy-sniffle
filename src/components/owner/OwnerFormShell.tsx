"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Check, ShieldCheck, Sparkles } from "lucide-react";
import type { EnrichedGym, GymSegment } from "@/lib/types/scout";
import { isAnswered, type AnswerMap, type FieldAnswer } from "@/lib/owner/answerTypes";
import {
  activeBranches,
  FORM_SECTIONS,
  SECTION_ORDER,
  SHORT_EXIT_EMAIL_FIELD,
  SHORT_SECTIONS,
  visibleFields,
} from "@/lib/owner/formConfig";
import { emptyAnswers } from "@/lib/owner/prefill";
import { stripHiddenFields } from "@/lib/owner/diff";
import { CONFIG_VERSION, localStoragePersistence, type OwnerFormDraft } from "@/lib/owner/persistence";
import { SectionRenderer } from "./SectionRenderer";
import { ProgressBar } from "./ProgressBar";
import { ResumeScreen } from "./ResumeScreen";
import { ReviewScreen } from "./ReviewScreen";

const LAST_SHORT = SHORT_SECTIONS[SHORT_SECTIONS.length - 1];
const FIRST_FULL_INDEX = SECTION_ORDER.findIndex((id) => !SHORT_SECTIONS.includes(id));
const E_SECTION = FORM_SECTIONS.find((s) => s.id === "E");

type Mode = "loading" | "resume" | "form" | "review";
type Milestone = "short" | "full" | null;
type Finished = "short" | "full" | null;

/* Badges are earned from REAL answers (never-fabricate) — NOT from navigating
 * past sections. Skipping everything must NOT grant Owner Listed / Gym Verified. */
function ownerListedFrom(a: AnswerMap): boolean {
  return (
    isAnswered(a.a_segment) &&
    (isAnswered(a.c_daypass) ||
      isAnswered(a.c_monthly) ||
      isAnswered(a.c_guest_model) ||
      isAnswered(a.b_hours) ||
      isAnswered(a.b_access)) &&
    isAnswered(a.d_amenities)
  );
}
function gymVerifiedFrom(a: AnswerMap, segment: GymSegment | null): boolean {
  if (!ownerListedFrom(a)) return false;
  const equipmentAnswered = E_SECTION
    ? visibleFields(E_SECTION, segment, a).some((f) => isAnswered(a[f.id]))
    : false;
  return (
    equipmentAnswered &&
    (isAnswered(a.h_vibes) || isAnswered(a.h_diff) || isAnswered(a.m_plans) || isAnswered(a.f_kind))
  );
}

/** Strip equipment answers for fields not in the active branch, so a corrected
 * segment never ships hidden-branch (often bad-scrape) equipment unseen (C7). */
function stripHiddenEquipment(a: AnswerMap, segment: GymSegment | null): AnswerMap {
  if (!E_SECTION) return a;
  // Strip ONLY cross-branch fields (branches exclude the active branch). Do NOT
  // apply showIf — a field conditionally hidden WITHIN the active branch (e.g.
  // e_pilates_fw while the strength toggle is briefly null) holds real answers
  // the owner entered and must survive an autosave.
  const branches = activeBranches(segment, a);
  const out = { ...a };
  for (const f of E_SECTION.fields) {
    if (f.branches && !f.branches.some((b) => branches.has(b))) delete out[f.id];
  }
  return out;
}

export function OwnerFormShell({
  token,
  gym,
  initialAnswers,
  initialTouched,
  reviewNote = null,
}: {
  token: string;
  gym: EnrichedGym;
  initialAnswers: AnswerMap;
  initialTouched?: string[];
  reviewNote?: string | null;
}) {
  const [mode, setMode] = useState<Mode>("loading");
  const [answers, setAnswers] = useState<AnswerMap>(initialAnswers);
  // Field ids the owner explicitly interacted with — the server uses this as
  // the "confirmed" signal (untouched prefill must never publish as owner data).
  // Seeded from a needs_info re-edit's round-1 touched set so those confirmations
  // are re-derived rather than silently dropped.
  const [touched, setTouched] = useState<Set<string>>(new Set(initialTouched ?? []));
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [activeIndex, setActiveIndex] = useState(0);
  const [milestone, setMilestone] = useState<Milestone>(null);
  const [shortShown, setShortShown] = useState(false);
  const [finished, setFinished] = useState<Finished>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // "Review my answers" after a submission shows the read-only view (D) —
  // corrections route through email by choice. The editable re-entry point is
  // "Add the full listing", which ARMS a real second submit (see below).
  const [reviewingSubmitted, setReviewingSubmitted] = useState(false);
  // State (not a ref) because the resume screen renders from it — set once by
  // the mount effect before mode flips to "resume", never written again.
  const [savedDraft, setSavedDraft] = useState<OwnerFormDraft | null>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const submittedRef = useRef(false);
  const inFlightRef = useRef(false);
  // Armed when the owner re-enters the form after a successful submit (the
  // short-path → "Add the full listing" flow). The next finish() POSTs again;
  // the server accepts it as a same-token revision while the submission is
  // still quarantined 'pending' (api/owner/submit — the followUp path).
  const resubmitArmedRef = useRef(false);

  // POST the answer map to the owner-submission backend — once per session,
  // unless a resubmit-armed re-entry POSTs again as a same-token revision.
  // The submission is quarantined (status 'pending') for staff review — it never
  // touches the live catalog here. Failure keeps the localStorage draft for retry.
  const submitOnce = async (): Promise<boolean> => {
    if (inFlightRef.current) return false;
    if (submittedRef.current && !resubmitArmedRef.current) return true;
    inFlightRef.current = true;
    try {
      // Strip EVERYTHING hidden (all sections, branches + showIf) at submit so
      // a hidden-field answer never ships; the server re-derives visibility too.
      const strippedAnswers = stripHiddenFields(answers, segment);
      const res = await fetch("/api/owner/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          answers: strippedAnswers,
          touchedFields: [...touched].filter((id) => id in strippedAnswers),
          contactName: answers.ct_name?.kind === "text" ? answers.ct_name.value : undefined,
          contactRole:
            answers.ct_role?.kind === "choice" ? (answers.ct_role.value ?? undefined) : undefined,
          contactEmail: answers.ct_email?.kind === "text" ? answers.ct_email.value : undefined,
        }),
      });
      if (!res.ok) {
        console.error("owner submit failed:", res.status);
        return false; // refs untouched — retry allowed
      }
      localStoragePersistence.clear(token);
      submittedRef.current = true;
      resubmitArmedRef.current = false;
      return true;
    } catch (e) {
      console.error("owner submit error:", e);
      return false;
    } finally {
      inFlightRef.current = false;
    }
  };

  const finish = async (kind: Exclude<Finished, null>) => {
    setSubmitError(null);
    // Only show the success card if the submission actually landed — otherwise the
    // owner would be told they're listed when nothing was stored.
    const ok = await submitOnce();
    if (ok) setFinished(kind);
    else setSubmitError("We couldn't submit your listing — please check your connection and try again.");
  };

  // Equipment branching follows the owner's live answer (A4), falling back to
  // the gym's DB segment — so correcting the segment re-tailors the form.
  const answeredSegment =
    answers.a_segment?.kind === "choice" ? (answers.a_segment.value as GymSegment | null) : null;
  const segment = answeredSegment ?? gym.segment;

  const ownerListedEarned = ownerListedFrom(answers);
  const gymVerifiedEarned = gymVerifiedFrom(answers, segment);

  // Decide resume vs fresh on mount (client only — avoids hydration mismatch).
  // localStorage is the instant cache; the server draft enables cross-device
  // resume. Whichever is newer wins; a dead/slow server falls back to local.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const local = localStoragePersistence.load(token);
      let server: OwnerFormDraft | null = null;
      try {
        const res = await fetch(`/api/owner/draft?token=${encodeURIComponent(token)}`, {
          signal: AbortSignal.timeout(3000),
        });
        if (res.ok) server = ((await res.json()) as { draft: OwnerFormDraft | null }).draft ?? null;
      } catch {
        /* offline / timeout → localStorage only */
      }
      if (cancelled) return;
      const pick = [local, server]
        .filter((d): d is OwnerFormDraft => !!d)
        .sort((a, b) => (b.lastSaved || "").localeCompare(a.lastSaved || ""))[0];
      // Resume if the owner made ANY progress — a completed section OR any touched
      // field. Gating on completedSections alone discarded (then clobbered) a draft
      // where the owner edited fields in the first section without clicking Continue.
      if (pick && (pick.completedSections.length > 0 || (pick.touched?.length ?? 0) > 0)) {
        setSavedDraft(pick);
        setMode("resume");
      } else {
        setMode("form");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  // Debounced autosave once the owner is actively filling the form.
  useEffect(() => {
    if (mode !== "form") return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      const draft: OwnerFormDraft = {
        token,
        gymId: gym.id,
        version: CONFIG_VERSION,
        answers: stripHiddenEquipment(answers, segment),
        completedSections: [...completed],
        touched: [...touched],
        contactName: answers.ct_name?.kind === "text" ? answers.ct_name.value : "",
        contactRole: answers.ct_role?.kind === "choice" ? (answers.ct_role.value ?? "") : "",
        lastSaved: new Date().toISOString(),
      };
      localStoragePersistence.save(token, draft);
      // best-effort cross-device sync; never block the form on the network
      fetch("/api/owner/draft", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token,
          version: CONFIG_VERSION,
          answers: draft.answers,
          completedSections: draft.completedSections,
          touched: draft.touched,
          contactName: draft.contactName,
          contactRole: draft.contactRole,
        }),
      }).catch(() => {});
    }, 800);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [answers, completed, touched, mode, token, gym.id, segment]);

  const markTouched = (fieldId: string) =>
    setTouched((prev) => (prev.has(fieldId) ? prev : new Set(prev).add(fieldId)));

  const patchAnswer = (fieldId: string, answer: FieldAnswer) => {
    setAnswers((prev) => ({ ...prev, [fieldId]: answer }));
    markTouched(fieldId);
  };

  // Functional append for voice dictation — reads the LATEST value so rapid
  // final segments don't clobber each other via a stale closure (I11).
  const appendText = (fieldId: string, text: string) => {
    setAnswers((prev) => {
      const cur = prev[fieldId];
      const existing = cur?.kind === "text" ? cur.value : "";
      return { ...prev, [fieldId]: { kind: "text", value: existing ? `${existing} ${text}` : text } };
    });
    markTouched(fieldId);
  };

  const resumeDraft = () => {
    const draft = savedDraft;
    if (draft) {
      const merged = { ...emptyAnswers(), ...draft.answers };
      setAnswers(merged);
      setTouched(new Set(draft.touched ?? []));
      const done = new Set(draft.completedSections);
      setCompleted(done);
      setShortShown(ownerListedFrom(merged));
      const idx = SECTION_ORDER.findIndex((id) => !done.has(id));
      setActiveIndex(idx === -1 ? SECTION_ORDER.length - 1 : idx);
    }
    setMode("form");
  };

  const startOver = () => {
    localStoragePersistence.clear(token);
    fetch("/api/owner/draft", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token }),
    }).catch(() => {});
    setAnswers(initialAnswers);
    setTouched(new Set());
    setCompleted(new Set());
    setShortShown(false);
    setActiveIndex(0);
    setFinished(null);
    setReviewingSubmitted(false);
    setMode("form");
  };

  const advance = () => {
    if (milestone) return; // overlay is up — ignore taps behind it
    const curId = SECTION_ORDER[activeIndex];
    const next = new Set(completed);
    next.add(curId);
    setCompleted(next);

    if (activeIndex === SECTION_ORDER.length - 1) {
      setMode("review"); // final review before submit (I10)
      return;
    }
    // Owner Listed fires only when genuinely EARNED (real answers), not from
    // skipping through the short path (C1 — no fake badges).
    if (curId === LAST_SHORT && ownerListedEarned && !shortShown) {
      setShortShown(true);
      setMilestone("short");
      return;
    }
    setActiveIndex((i) => Math.min(i + 1, SECTION_ORDER.length - 1));
  };

  const goBack = () => setActiveIndex((i) => Math.max(0, i - 1));

  const jump = (sectionId: string) => {
    setMilestone(null);
    setFinished(null);
    setReviewingSubmitted(false);
    setMode("form");
    setActiveIndex(SECTION_ORDER.indexOf(sectionId));
  };

  if (mode === "loading") {
    return <div className="mx-auto h-40 max-w-2xl animate-pulse rounded-2xl bg-paper-raise" />;
  }

  if (mode === "resume" && savedDraft) {
    const draft = savedDraft;
    const pct = Math.round((draft.completedSections.length / SECTION_ORDER.length) * 100);
    const nextIdx = SECTION_ORDER.findIndex((id) => !draft.completedSections.includes(id));
    const nextLabel = FORM_SECTIONS[nextIdx === -1 ? 0 : nextIdx].label;
    return (
      <div className="px-4 py-12">
        <ResumeScreen
          gymName={gym.name}
          percentComplete={pct}
          nextSectionLabel={nextLabel}
          lastSaved={draft.lastSaved}
          onResume={resumeDraft}
          onStartOver={startOver}
        />
      </div>
    );
  }

  if (finished) {
    // Post-submit "Review my answers" — read-only by choice (D): corrections go
    // through email. (The server CAN now take a same-token revision — that path
    // is reserved for the armed "Add the full listing" flow below.)
    if (reviewingSubmitted) {
      return (
        <ReviewScreen
          gymName={gym.name}
          answers={answers}
          prefill={initialAnswers}
          segment={segment}
          earned={finished === "full" ? gymVerifiedEarned : ownerListedEarned}
          readOnly
          onBack={() => setReviewingSubmitted(false)}
        />
      );
    }
    return (
      <FinishCard
        kind={finished}
        earned={finished === "short" ? ownerListedEarned : gymVerifiedEarned}
        gymName={gym.name}
        contactEmail={answers.ct_email?.kind === "text" ? answers.ct_email.value.trim() : ""}
        onReview={() => setReviewingSubmitted(true)}
        onContinue={
          finished === "short"
            ? () => {
                // Arm a REAL second submit — without this, finish("full") would
                // no-op on the ref guard and silently discard the new sections.
                resubmitArmedRef.current = true;
                jump(SECTION_ORDER[FIRST_FULL_INDEX]);
              }
            : undefined
        }
      />
    );
  }

  if (mode === "review") {
    return (
      <ReviewScreen
        gymName={gym.name}
        answers={answers}
        prefill={initialAnswers}
        segment={segment}
        earned={gymVerifiedEarned}
        error={submitError}
        onSubmit={() => finish("full")}
        onEdit={jump}
      />
    );
  }

  const section = FORM_SECTIONS[activeIndex];
  const isFirst = activeIndex === 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      {/* header */}
      <div className="mb-6">
        <p className="readout text-pool-deep">Owner listing</p>
        <h1 className="display mt-1 text-2xl text-ink sm:text-3xl">{gym.name}</h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm text-ink/55">
          <Sparkles className="h-3.5 w-3.5 text-blaze" aria-hidden />
          We pre-filled this from public info — just confirm or fix anything. Nothing is shared until you submit.
        </p>
      </div>

      {reviewNote && (
        <div className="mb-6 rounded-xl border border-blaze/30 bg-blaze-tint/40 p-4">
          <p className="readout text-blaze-deep">Changes requested</p>
          <p className="mt-1 text-sm text-ink">{reviewNote}</p>
          <p className="mt-1.5 text-xs text-ink/55">
            Update the relevant section and resubmit — your previous answers are loaded.
          </p>
        </div>
      )}

      <ProgressBar
        completed={completed}
        activeSection={section.id}
        onJump={jump}
        ownerListed={ownerListedEarned}
      />

      {/* section card */}
      <div className="mt-7 rounded-2xl border border-paper-line bg-paper-raise p-5 sm:p-7">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="display text-xl text-ink">{section.label}</h2>
          <span className="readout text-ink/40">
            {section.path === "short" ? "Basics" : "Full listing"}
          </span>
        </div>

        <SectionRenderer
          section={section}
          answers={answers}
          prefill={initialAnswers}
          segment={segment}
          token={token}
          onPatch={patchAnswer}
          onAppendText={appendText}
        />
      </div>

      {/* nav */}
      <div className="mt-6 flex items-center justify-between">
        <button
          type="button"
          onClick={goBack}
          disabled={isFirst}
          className="inline-flex items-center gap-1.5 text-sm text-ink/55 hover:text-ink disabled:invisible"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden /> Back
        </button>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={advance}
            disabled={!!milestone}
            className="text-sm text-ink/45 hover:text-blaze-deep disabled:opacity-40"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={advance}
            disabled={!!milestone}
            className="inline-flex items-center gap-2 rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper transition-colors hover:bg-ink-raise disabled:opacity-40"
          >
            {activeIndex === SECTION_ORDER.length - 1 ? "Finish" : "Continue"}
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {submitError && (
        <p className="mx-auto mt-4 max-w-2xl px-4 text-sm text-blaze-deep" role="alert">
          {submitError}
        </p>
      )}

      {milestone && (
        <MilestoneOverlay
          kind={milestone}
          earned={milestone === "short" ? ownerListedEarned : gymVerifiedEarned}
          email={answers.ct_email?.kind === "text" ? answers.ct_email.value : ""}
          onEmailChange={(value) => patchAnswer("ct_email", { kind: "text", value })}
          onContinue={() => {
            setMilestone(null);
            if (milestone === "short") setActiveIndex(FIRST_FULL_INDEX);
            else finish("full");
          }}
          onDone={() => {
            setMilestone(null);
            finish(milestone === "short" ? "short" : "full");
          }}
        />
      )}
    </div>
  );
}

function MilestoneOverlay({
  kind,
  earned,
  email,
  onEmailChange,
  onContinue,
  onDone,
}: {
  kind: "short" | "full";
  earned: boolean;
  /** ct_email's current value — only surfaced/editable on the short-path exit,
   *  where "I'm done for now" is otherwise a zero-contact dead end (C3). */
  email: string;
  onEmailChange: (value: string) => void;
  onContinue: () => void;
  onDone: () => void;
}) {
  const isShort = kind === "short";
  const title = isShort ? "Owner Listed unlocked" : earned ? "Gym Verified!" : "Listing saved";
  const body = isShort
    ? "Your pricing, hours and amenities now outrank scraped data. Add equipment and a few more details to earn the full Gym Verified badge."
    : earned
      ? "Your full listing is complete — the strongest trust signal on Scout. Thank you."
      : "Thanks — we've saved what you entered. Fill in equipment and pricing details to earn the Gym Verified badge.";
  // Lock body scroll while open + Escape to dismiss (mobile-safe modal).
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onDone]);
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-ink/40 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onDone();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="my-auto max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-paper-line bg-paper-raise p-7 text-center"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-pool-tint">
          {isShort || earned ? (
            <ShieldCheck className="h-6 w-6 text-pool-deep" aria-hidden />
          ) : (
            <Check className="h-6 w-6 text-pool-deep" aria-hidden />
          )}
        </div>
        <h3 className="display mt-4 text-xl text-ink">{title}</h3>
        <p className="mt-2 text-sm text-ink/65">{body}</p>
        <div className="mt-6 space-y-2.5">
          {isShort ? (
            <>
              <div className="text-left">
                <label htmlFor="milestone-email" className="mb-1.5 block text-xs font-medium text-ink/70">
                  {SHORT_EXIT_EMAIL_FIELD.label}
                </label>
                <input
                  id="milestone-email"
                  type="email"
                  inputMode="email"
                  value={email}
                  onChange={(e) => onEmailChange(e.target.value)}
                  placeholder={SHORT_EXIT_EMAIL_FIELD.placeholder}
                  className="w-full rounded-lg border border-paper-line bg-paper-raise px-3 py-2 text-sm text-ink placeholder:text-ink/35 focus:border-ink/40 focus:outline-none"
                />
                {SHORT_EXIT_EMAIL_FIELD.hint && (
                  <p className="mt-1.5 text-xs text-ink/45">{SHORT_EXIT_EMAIL_FIELD.hint}</p>
                )}
              </div>
              <button
                onClick={onContinue}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-3 text-sm font-medium text-paper hover:bg-ink-raise"
              >
                Continue to Gym Verified <ArrowRight className="h-4 w-4" aria-hidden />
              </button>
              <button onClick={onDone} className="text-xs text-ink/50 hover:text-ink">
                I&apos;m done for now
              </button>
            </>
          ) : (
            <button
              onClick={onDone}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-3 text-sm font-medium text-paper hover:bg-ink-raise"
            >
              Finish
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FinishCard({
  kind,
  earned,
  gymName,
  contactEmail,
  onReview,
  onContinue,
}: {
  kind: "short" | "full";
  earned: boolean;
  gymName: string;
  /** Set only when the owner actually gave an email (short-path exit prompt or
   *  the full K section) — lets the confirmation be concrete, not generic. */
  contactEmail?: string;
  onReview: () => void;
  onContinue?: () => void;
}) {
  const title = kind === "short" ? "Owner Listed" : earned ? "Gym Verified" : "Listing saved";
  return (
    <div className="mx-auto max-w-md px-4 py-16 text-center">
      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-pool-tint">
        <Check className="h-7 w-7 text-pool-deep" strokeWidth={2.5} aria-hidden />
      </div>
      <h1 className="display mt-4 text-2xl text-ink">{title}</h1>
      <p className="mt-2 text-sm text-ink/65">
        Thanks — we have what we need for {gymName}. Scout reviews submissions within 2 business
        days; your listing updates as soon as the facts are approved.
      </p>
      {contactEmail && (
        <p className="mt-2 text-sm text-ink/65">
          {/* No "we've sent a confirmation" claim: email is in test mode until the
              sending domain verifies, so that would be a false statement today. */}
          We&apos;ll follow up at {contactEmail} if we have any questions.
        </p>
      )}
      <div className="mt-6 flex flex-col items-center gap-2.5">
        {onContinue && (
          <button
            onClick={onContinue}
            className="rounded-lg bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-ink-raise"
          >
            Add the full listing
          </button>
        )}
        <button onClick={onReview} className="text-sm text-ink/55 hover:text-ink">
          Review my answers
        </button>
        <Link href="/" className="readout mt-2 text-ink/40 hover:text-ink">
          Back to Scout
        </Link>
      </div>
    </div>
  );
}
