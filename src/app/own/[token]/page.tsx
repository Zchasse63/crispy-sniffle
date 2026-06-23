import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { fetchGymsByIds } from "@/lib/queries/gyms";
import { hashToken } from "@/lib/owner/token";
import { buildPrefillAnswers } from "@/lib/owner/prefill";
import { OwnerFormShell } from "@/components/owner/OwnerFormShell";
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
  const { data: gymId } = await client.rpc("resolve_owner_invite", { p_token_hash: hashToken(token) });
  if (gymId) {
    [gym] = await fetchGymsByIds(client, [gymId as string]);
  }

  // A real, unexpired invite is required — no slug fallback. Unknown/expired/used
  // tokens resolve to nothing → 404 (the page never reveals which gyms exist).
  if (!gym) notFound();

  const initialAnswers = buildPrefillAnswers(gym);

  return <OwnerFormShell token={token} gym={gym} initialAnswers={initialAnswers} />;
}
