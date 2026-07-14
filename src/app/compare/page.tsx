import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { fetchGymsBySlugs } from "@/lib/queries/gyms";
import { CompareClient } from "@/components/compare/CompareClient";

export const dynamic = "force-dynamic";

/** Server shell for /compare: exists so shared ?gyms= links get real OG/Twitter
 *  cards ("Compare: A vs B vs C") instead of the generic root card. All compare
 *  interaction lives in CompareClient (client component — shortlist store,
 *  picker state, shared-mode fetch). Own-mode selections aren't in the URL, so
 *  metadata for them stays generic by design. */
function parseSlugsParam(gymsParam: string | undefined): string[] {
  if (!gymsParam) return [];
  const raw = gymsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(raw)].slice(0, 3);
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ gyms?: string }>;
}): Promise<Metadata> {
  const { gyms } = await searchParams;
  const fallback: Metadata = {
    title: "Compare — Scout",
    description:
      "Line up shortlisted gyms attribute by attribute — day-pass prices, hours, equipment, and access.",
  };
  const slugs = parseSlugsParam(gyms);
  if (slugs.length < 2) return fallback;
  const client = await getServerClient();
  const found = await fetchGymsBySlugs(client, slugs);
  if (found.length < 2) return fallback;
  const names = found.map((g) => g.name).join(" vs ");
  const title = `Compare: ${names} — Scout`;
  const description = `Day-pass prices, hours, equipment and access — ${names}, attribute by attribute on Scout.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

export default function ComparePage() {
  return <CompareClient />;
}
