import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { fetchCityGyms } from "@/lib/queries/gyms";
import { DiscoveryClient } from "@/components/discovery/DiscoveryClient";

// Beta: always read live data (the dataset is actively growing) — matches "/".
export const dynamic = "force-dynamic";

const BASE = "https://scout-gym.netlify.app";

/**
 * SEO-addressable per-city discovery surface — same DiscoveryClient as "/",
 * just resolved by path slug instead of the geo/cookie/param chain. Unknown
 * or not-yet-live slugs (including the 8 placeholder metros, which are
 * always is_live=false) 404 rather than rendering an empty/misleading page.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const client = await getServerClient();
  const { city } = await fetchCityGyms(client, slug);
  if (!city || !city.is_live) return {};
  const title = `Scout — Find your fit in ${city.name}, ${city.state}`;
  const description = `AI-powered gym discovery for ${city.name}. Scout scans the landscape of gyms and surfaces the right fit for you — based on what matters most.`;
  return {
    title,
    description,
    alternates: { canonical: `${BASE}/city/${city.slug}` },
    openGraph: { title, description, url: `${BASE}/city/${city.slug}` },
    twitter: { card: "summary", title, description },
  };
}

export default async function CityPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const client = await getServerClient();
  const { city, gyms } = await fetchCityGyms(client, slug);

  if (!city || !city.is_live) notFound();

  return <DiscoveryClient city={city} gyms={gyms} />;
}
