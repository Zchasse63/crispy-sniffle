import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { fetchGymsByIds } from "@/lib/queries/gyms";
import { hashToken } from "@/lib/owner/token";
import { buildPrefillAnswers } from "@/lib/owner/prefill";
import { OwnerFormShell } from "@/components/owner/OwnerFormShell";
import type { AnswerMap } from "@/lib/owner/answerTypes";
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
  // tokens resolve to nothing → 404 (the page never reveals which gyms exist).
  if (!gym) notFound();

  // Re-edit (needs_info): start from the owner's PRIOR answers layered over the
  // catalog prefill, and surface the staff's requested change.
  const priorAnswers = (ctx?.prior_answers as AnswerMap | null) ?? null;
  const reviewNote = ctx?.review_note ?? null;
  const initialAnswers: AnswerMap = priorAnswers
    ? { ...buildPrefillAnswers(gym), ...priorAnswers }
    : buildPrefillAnswers(gym);

  return <OwnerFormShell token={token} gym={gym} initialAnswers={initialAnswers} reviewNote={reviewNote} />;
}
