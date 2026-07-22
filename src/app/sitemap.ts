import type { MetadataRoute } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { fetchCities } from "@/lib/queries/gyms";
import { paginateAll } from "@/lib/supabase/paginate";

const BASE = "https://scout-gym.netlify.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const client = await getServerClient();
  const [gyms, cities] = await Promise.all([
    paginateAll<{ slug: string; updated_at: string | null; city_id: string }>((from, to) =>
      client
        .from("gyms")
        .select("slug, updated_at, city_id")
        // Match public browse + detail: never advertise closed/relocated/deduped gyms.
        .not("status", "in", "(closed,moved,duplicate)")
        .order("slug", { ascending: true })
        .range(from, to) as PromiseLike<{
        data: { slug: string; updated_at: string | null; city_id: string }[] | null;
        error: unknown;
      }>,
    ),
    fetchCities(client),
  ]);
  const liveCities = cities.filter((c) => c.is_live);
  // Gyms in non-live cities are placeholder/seed listings — the detail route 404s
  // them, so they must not be advertised in the sitemap either. Gate by live city.
  const liveCityIds = new Set(liveCities.map((c) => c.id));
  const liveGyms = gyms.filter((g) => liveCityIds.has(g.city_id));
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
    ...liveGyms.map((g) => ({
      url: `${BASE}/gym/${g.slug}`,
      lastModified: g.updated_at ? new Date(g.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
