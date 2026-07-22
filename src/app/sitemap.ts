import type { MetadataRoute } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { fetchCities } from "@/lib/queries/gyms";
import { paginateAll } from "@/lib/supabase/paginate";
import { buildSitemapEntries } from "@/lib/sitemap/buildSitemapEntries";

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
  // Gyms in non-live cities are placeholder/seed listings — the detail route 404s
  // them, so they must not be advertised in the sitemap either. Gate by live city.
  return buildSitemapEntries(BASE, gyms, cities) as MetadataRoute.Sitemap;
}
