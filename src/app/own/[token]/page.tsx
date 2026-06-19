import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServiceClient } from "@/lib/admin/service";
import { fetchGymBySlug, fetchGymsByIds } from "@/lib/queries/gyms";
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
 * (resolved via owner_invites, which is staff-RLS → service client) or, for the
 * prototype, a gym slug. Prefilled from the live gym so the owner confirms/corrects.
 */
export default async function OwnerFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  // owner_invites is staff-only RLS, so resolve invites with the service client.
  const service = getServiceClient();

  let gym: EnrichedGym | null = null;
  const { data: invite } = await service
    .from("owner_invites")
    .select("gym_id, status, expires_at")
    .eq("token_hash", hashToken(token))
    .maybeSingle();

  if (invite) {
    const live = invite.status === "active" && (!invite.expires_at || new Date(invite.expires_at).getTime() > Date.now());
    if (live) [gym] = await fetchGymsByIds(service, [invite.gym_id]);
  } else {
    // Prototype fallback: treat the token as a gym slug.
    gym = await fetchGymBySlug(service, token);
  }

  if (!gym) notFound();

  const initialAnswers = buildPrefillAnswers(gym);

  return <OwnerFormShell token={token} gym={gym} initialAnswers={initialAnswers} />;
}
