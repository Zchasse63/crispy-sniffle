import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { fetchGymBySlug } from "@/lib/queries/gyms";
import { buildPrefillAnswers } from "@/lib/owner/prefill";
import { OwnerFormShell } from "@/components/owner/OwnerFormShell";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Confirm your gym · Scout",
  robots: { index: false, follow: false },
};

/**
 * Owner self-serve form. In this prototype the [token] segment is the gym
 * SLUG (real tokenized invites land in the backend step). Prefilled from the
 * live gym record so the owner confirms/corrects rather than authors.
 */
export default async function OwnerFormPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const client = await getServerClient();
  const gym = await fetchGymBySlug(client, token);
  if (!gym) notFound();

  const initialAnswers = buildPrefillAnswers(gym);

  return <OwnerFormShell token={token} gym={gym} initialAnswers={initialAnswers} />;
}
