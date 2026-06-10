"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Flag, Loader2, MessageSquareText, Star } from "lucide-react";
import { getBrowserClient } from "@/lib/supabase/browser";
import { fetchGymReviews, type CommunityLink, type GymReview } from "@/lib/queries/community";
import { useUserStore } from "@/stores/userStore";
import { SignInModal } from "@/components/auth/SignInModal";

const CONTEXT_LABELS: Record<string, string> = {
  member: "Member",
  day_pass: "Day pass",
  drop_in: "Drop-in",
  class: "Class",
  trial: "Trial",
};

function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((n) =>
        onChange ? (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            onClick={() => onChange(n)}
            className="p-0.5"
          >
            <Star
              className={`h-5 w-5 ${n <= value ? "fill-blaze text-blaze" : "text-ink/30"}`}
              aria-hidden
            />
          </button>
        ) : (
          <Star
            key={n}
            className={`h-3.5 w-3.5 ${n <= value ? "fill-blaze text-blaze" : "text-ink/25"}`}
            aria-hidden
          />
        ),
      )}
    </span>
  );
}

function ReviewForm({ gymId, onPosted }: { gymId: string; onPosted: () => void }) {
  const user = useUserStore((s) => s.user);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [context, setContext] = useState("day_pass");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!user || rating === 0 || busy) return;
    setBusy(true);
    setErr(null);
    const client = getBrowserClient();
    const { error } = await client.from("gym_reviews").upsert(
      {
        gym_id: gymId,
        user_id: user.id,
        rating,
        comment: comment.trim() || null,
        visit_context: context,
      },
      { onConflict: "gym_id,user_id" },
    );
    setBusy(false);
    if (error) {
      setErr("Couldn't post the review — try again.");
    } else {
      // denormalized rating refresh is best-effort; never blocks the post
      client.rpc("refresh_gym_rating", { gym_uuid: gymId }).then(undefined, () => {});
      setRating(0);
      setComment("");
      onPosted();
    }
  };

  return (
    <div className="mt-4 rounded-lg border border-paper-line bg-paper p-4">
      <p className="readout text-ink/70">Your review</p>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <Stars value={rating} onChange={setRating} />
        <select
          value={context}
          onChange={(e) => setContext(e.target.value)}
          aria-label="How did you visit?"
          className="font-mono rounded-md border border-paper-line bg-paper-raise px-2 py-1.5 text-[11px] uppercase tracking-wide text-ink/80"
        >
          {Object.entries(CONTEXT_LABELS).map(([k, v]) => (
            <option key={k} value={k}>
              {v}
            </option>
          ))}
        </select>
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value.slice(0, 1000))}
        placeholder="Equipment condition, crowding, staff, the details that matter…"
        rows={3}
        className="mt-3 w-full rounded-lg border border-paper-line bg-paper-raise p-3 text-sm text-ink outline-none placeholder:text-ink/45 focus:border-pool"
      />
      <div className="mt-2 flex items-center justify-between">
        <span className="font-mono text-[10px] uppercase tracking-wide text-ink/55">
          {1000 - comment.length} left
        </span>
        <button
          type="button"
          onClick={() => void submit()}
          disabled={busy || rating === 0}
          className="display rounded-lg bg-blaze-deep px-4 py-2 text-xs tracking-wider text-white transition-colors hover:bg-blaze disabled:opacity-50"
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : "Post review"}
        </button>
      </div>
      {err && <p className="mt-2 text-xs text-blaze-deep">{err}</p>}
    </div>
  );
}

export function CommunitySection({
  gymId,
  gymName,
  links,
}: {
  gymId: string;
  gymName: string;
  links: CommunityLink[];
}) {
  const user = useUserStore((s) => s.user);
  const [reviews, setReviews] = useState<GymReview[] | null>(null);
  const [modal, setModal] = useState(false);
  const [reported, setReported] = useState<Set<string>>(new Set());

  const load = () => {
    fetchGymReviews(getBrowserClient(), gymId)
      .then(setReviews)
      .catch(() => setReviews([]));
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, [gymId]);

  const report = async (id: string) => {
    if (reported.has(id)) return;
    setReported(new Set([...reported, id]));
    await getBrowserClient().rpc("report_review", { review_uuid: id });
  };

  return (
    <section className="rounded-xl border border-paper-line bg-paper-raise p-5">
      <h2 className="readout flex items-center gap-1.5 text-ink/65">
        <MessageSquareText className="h-3.5 w-3.5" aria-hidden /> From the community
      </h2>

      {/* reviews */}
      <div className="mt-3">
        {reviews === null ? (
          <div className="skeleton h-14 w-full rounded-lg" />
        ) : reviews.length === 0 ? (
          <p className="text-sm text-ink/70">
            No reviews yet — be the first to train here and tell Tampa how it went.
          </p>
        ) : (
          <ul className="space-y-3">
            {reviews.map((r) => (
              <li key={r.id} className="rounded-lg border border-paper-line bg-paper p-3.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <Stars value={r.rating} />
                    {r.visit_context && (
                      <span className="font-mono rounded border border-paper-line px-1.5 py-0.5 text-[9.5px] uppercase tracking-wide text-ink/65">
                        {CONTEXT_LABELS[r.visit_context] ?? r.visit_context}
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-[10px] uppercase tracking-wide text-ink/50">
                      {new Date(r.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {user && (
                      <button
                        type="button"
                        onClick={() => void report(r.id)}
                        aria-label="Report this review"
                        title={reported.has(r.id) ? "Reported" : "Report this review"}
                        className={`${reported.has(r.id) ? "text-blaze" : "text-ink/40 hover:text-blaze"} transition-colors`}
                      >
                        <Flag className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </span>
                </div>
                {r.comment && (
                  <p className="mt-2 text-sm leading-relaxed text-ink/85">{r.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}

        {user ? (
          <ReviewForm gymId={gymId} onPosted={load} />
        ) : (
          <button
            type="button"
            onClick={() => setModal(true)}
            className="readout mt-4 rounded-lg border border-paper-line px-3.5 py-2.5 text-ink/75 transition-colors hover:border-pool hover:text-ink"
          >
            Sign in to review {gymName}
          </button>
        )}
      </div>

      {/* outbound discussions — links only, never ingested content */}
      {links.length > 0 && (
        <div className="mt-5 border-t border-paper-line/60 pt-4">
          <p className="readout text-ink/65">Discussed around the web</p>
          <ul className="mt-2 space-y-1.5">
            {links.map((l) => (
              <li key={l.id}>
                <a
                  href={l.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-start gap-2 text-sm text-ink/85 hover:text-ink"
                >
                  <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-pool-deep" aria-hidden />
                  <span>
                    <span className="font-semibold underline decoration-pool/40 underline-offset-2 group-hover:decoration-pool">
                      {l.title}
                    </span>
                    <span className="font-mono ml-1.5 text-[10px] uppercase tracking-wide text-ink/55">
                      {l.platform}
                      {l.year ? ` · ${l.year}` : ""}
                    </span>
                    {l.topic_note && (
                      <span className="block text-xs leading-relaxed text-ink/65">{l.topic_note}</span>
                    )}
                  </span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* owner CTA */}
      <div className="mt-5 rounded-lg border border-dashed border-contour-deep/60 bg-paper p-3.5">
        <p className="text-sm text-ink/80">
          Run {gymName}?{" "}
          <a
            href={`mailto:zchasse89@gmail.com?subject=${encodeURIComponent(`Verify our listing: ${gymName}`)}`}
            className="font-semibold text-pool-deep underline decoration-pool/40 underline-offset-2 hover:decoration-pool"
          >
            Verify your info
          </a>{" "}
          — owner-confirmed facts get top billing.
        </p>
      </div>

      {modal && <SignInModal onClose={() => setModal(false)} />}
    </section>
  );
}
