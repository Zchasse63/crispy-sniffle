import type { MetadataRoute } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { fetchCities } from "@/lib/queries/gyms";

const BASE = "https://scout-gym.netlify.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const client = await getServerClient();
  const [{ data: gyms }, cities] = await Promise.all([
    client
      .from("gyms")
      .select("slug, updated_at")
      // Match public browse + detail: never advertise closed/relocated/deduped gyms.
      .not("status", "in", "(closed,moved,duplicate)")
      .order("slug"),
    fetchCities(client),
  ]);
  const liveCities = cities.filter((c) => c.is_live);
  return [
    { url: BASE, changeFrequency: "daily", priority: 1 },
    ...liveCities.map((c) => ({
      url: `${BASE}/city/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    { url: `${BASE}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${BASE}/trips`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/blog`, changeFrequency: "weekly", priority: 0.6 },
    ...(gyms ?? []).map((g) => ({
      url: `${BASE}/gym/${g.slug}`,
      lastModified: g.updated_at ? new Date(g.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
