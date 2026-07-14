import type { Metadata } from "next";
import Link from "next/link";
import { Link2Off } from "lucide-react";
import { getServerClient } from "@/lib/supabase/server";
import { fetchGymsByIds } from "@/lib/queries/gyms";
import { hashToken } from "@/lib/owner/token";
import { buildPrefillAnswers } from "@/lib/owner/prefill";
import { OwnerFormShell } from "@/components/owner/OwnerFormShell";
import type { AnswerMap } from "@/lib/owner/answerTypes";
import { mailtoHref } from "@/lib/contactInfo";
import type { EnrichedGym } from "@/lib/types/scout";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your gym · Scout",
  robots: { index: false, follow: false },
};

/**
 * Owner self-serve form. The [token] segment is either a real tokenized invite
 * (resolved via the anon-callable resolve_owner_invite RPC — no service key on
 * this public page) or, for the prototype, a gym slug. Prefilled from the live
 * gym so the owner confirms/corrects.
 */
export default async function OwnerFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getServerClient();

  let gym: EnrichedGym | null = null;
  const { data: ctxRows } = await client.rpc("resolve_owner_invite_context", { p_token_hash: hashToken(token) });
  const ctx = Array.isArray(ctxRows) ? ctxRows[0] : null;
  if (ctx?.gym_id) {
    [gym] = await fetchGymsByIds(client, [ctx.gym_id]);
  }

  // A real, unexpired invite is required — no slug fallback. Unknown/expired/used
  // tokens resolve to nothing, but that must NEVER fall through to the site-wide
  // 404 — that page reads as "this gym isn't on Scout," which isn't true. Render
  // a dedicated, reassuring screen instead; it still reveals nothing about which
  // gyms exist (no gym-specific detail is ever rendered here).
  if (!gym) {
    return (
      <div className="px-4 py-12">
        <div className="mx-auto max-w-md rounded-2xl border border-paper-line bg-paper-raise p-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-blaze-tint/40">
            <Link2Off className="h-6 w-6 text-blaze-deep" aria-hidden />
          </div>
          <p className="readout mt-4 text-blaze-deep">Link no longer active</p>
          <h1 className="display mt-2 text-2xl text-ink">This invite has expired or was already used.</h1>
          <p className="mt-3 text-sm text-ink/65">
            Your gym is still listed on Scout — nothing about that has changed. Owner links are
            single-use and time-limited, so this one just needs replacing.
          </p>
          <a
            href={mailtoHref("Scout owner link request")}
            className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-ink py-3 text-sm font-medium text-paper transition-colors hover:bg-ink-raise"
          >
            Request a fresh link
          </a>
          <Link href="/" className="mt-3 inline-block text-xs text-ink/50 hover:text-ink">
            Back to Scout
          </Link>
        </div>
      </div>
    );
  }

  // Re-edit (needs_info): start from the owner's PRIOR answers layered over the
  // catalog prefill, and surface the staff's requested change.
  const priorAnswers = (ctx?.prior_answers as AnswerMap | null) ?? null;
  const reviewNote = ctx?.review_note ?? null;
  // Restore the round-1 touched set so re-derived confirmations survive the re-edit.
  const priorTouched = Array.isArray(ctx?.prior_touched) ? (ctx.prior_touched as string[]) : [];
  const initialAnswers: AnswerMap = priorAnswers
    ? { ...buildPrefillAnswers(gym), ...priorAnswers }
    : buildPrefillAnswers(gym);

  return (
    <OwnerFormShell
      token={token}
      gym={gym}
      initialAnswers={initialAnswers}
      initialTouched={priorTouched}
      reviewNote={reviewNote}
    />
  );
}
