/**
 * Pure sitemap URL assembly — gym pages gated by live cities.
 * Kept separate from the Next route so scale/regression tests can exercise
 * the filter + URL shape without a Supabase client or MetadataRoute runtime.
 */
export type SitemapGymRow = {
  slug: string;
  updated_at: string | null;
  city_id: string;
};

export type SitemapCityRow = {
  id: string;
  slug: string;
  is_live: boolean;
};

export type SitemapEntry = {
  url: string;
  lastModified?: Date;
  changeFrequency: "daily" | "weekly" | "monthly";
  priority: number;
};

export function buildSitemapEntries(
  base: string,
  gyms: SitemapGymRow[],
  cities: SitemapCityRow[],
): SitemapEntry[] {
  const liveCities = cities.filter((c) => c.is_live);
  const liveCityIds = new Set(liveCities.map((c) => c.id));
  const liveGyms = gyms.filter((g) => liveCityIds.has(g.city_id));
  return [
    { url: base, changeFrequency: "daily", priority: 1 },
    ...liveCities.map((c) => ({
      url: `${base}/city/${c.slug}`,
      changeFrequency: "daily" as const,
      priority: 0.9,
    })),
    { url: `${base}/about`, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/trips`, changeFrequency: "monthly", priority: 0.4 },
    { url: `${base}/blog`, changeFrequency: "weekly", priority: 0.6 },
    ...liveGyms.map((g) => ({
      url: `${base}/gym/${g.slug}`,
      lastModified: g.updated_at ? new Date(g.updated_at) : undefined,
      changeFrequency: "weekly" as const,
      priority: 0.8,
    })),
  ];
}
