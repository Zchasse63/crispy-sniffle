import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { fetchCity } from "@/lib/queries/gyms";
import { TripDetail } from "@/components/trips/TripDetail";

/** Trips live ONLY in localStorage (zustand persist) — there is no
 *  server-side trip record to render, so this shell does no data fetching
 *  for the page body itself. It exists to (a) satisfy the Next-16
 *  `params`/`searchParams`-are-Promises convention established in
 *  gym/[slug] and compare, and (b) give shared links an honest OG title
 *  using only what's genuinely knowable server-side: the destination city
 *  (via the `c` search param) and the raw date strings — never a gym count
 *  or gym names, which live only in the visiting browser's localStorage. */
export const dynamic = "force-dynamic";

function fmtRangeForMeta(s: string | undefined, e: string | undefined): string | null {
  if (!s || !e) return null;
  const [sy, sm, sd] = s.split("-").map(Number);
  const [ey, em, ed] = e.split("-").map(Number);
  if (!sy || !sm || !sd || !ey || !em || !ed) return null;
  const fmt = (y: number, m: number, d: number) =>
    new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${fmt(sy, sm, sd)} – ${fmt(ey, em, ed)}`;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; s?: string; e?: string }>;
}): Promise<Metadata> {
  const fallback: Metadata = {
    title: "Trip — Scout",
    description: "Gyms Scout lined up for your trip, wherever you land.",
  };
  const { c, s, e } = await searchParams;
  if (!c) return fallback;
  const client = await getServerClient();
  const city = await fetchCity(client, c);
  if (!city) return fallback;
  const range = fmtRangeForMeta(s, e);
  const title = `${city.name} trip — Scout`;
  const description = range
    ? `Gyms Scout lined up for your ${city.name} trip, ${range}.`
    : `Gyms Scout lined up for your ${city.name} trip.`;
  return {
    title,
    description,
    openGraph: { title, description },
    twitter: { card: "summary", title, description },
  };
}

export default async function TripDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ c?: string; s?: string; e?: string }>;
}) {
  const { id } = await params;
  const { c, s, e } = await searchParams;
  return <TripDetail id={id} citySlug={c ?? null} startDate={s ?? null} endDate={e ?? null} />;
}
