import { cookies, headers } from "next/headers";
import { getServerClient } from "@/lib/supabase/server";
import { fetchCities, fetchCityGyms } from "@/lib/queries/gyms";
import { haversineMiles } from "@/lib/travel";
import type { City } from "@/lib/types/scout";
import { DiscoveryClient } from "@/components/discovery/DiscoveryClient";

// Beta: always read live data (the dataset is actively growing).
export const dynamic = "force-dynamic";

const GEO_COOKIE = "scout-city";

/**
 * Resolve which city "/" renders, in order:
 *   (a) ?city= param, if present and live
 *   (b) geo-IP nearest LIVE city (Netlify's x-nf-geo request header)
 *   (c) "scout-city" cookie, if set and live (written by CitySwitcher)
 *   (d) "tampa" (default)
 * RSC-only: x-nf-geo is read via next/headers, never middleware — this
 * Next version's proxy.ts (the middleware) emits no prod bundle.
 */
async function resolveCitySlug(cities: City[], cityParam: string | undefined): Promise<string> {
  const liveCities = cities.filter((c) => c.is_live);
  const liveSlugs = new Set(liveCities.map((c) => c.slug));

  if (cityParam && liveSlugs.has(cityParam)) return cityParam;

  // x-nf-geo: JSON {city, subdivision, country, latitude, longitude} — absent
  // in local dev, so this block naturally no-ops there.
  const h = await headers();
  const geoHeader = h.get("x-nf-geo");
  if (geoHeader) {
    let geo: { latitude?: unknown; longitude?: unknown } | null = null;
    try {
      geo = JSON.parse(geoHeader);
    } catch {
      geo = null;
    }
    if (geo && typeof geo.latitude === "number" && typeof geo.longitude === "number") {
      const origin = { lat: geo.latitude, lng: geo.longitude };
      let nearestSlug: string | null = null;
      let nearestMiles = Infinity;
      for (const c of liveCities) {
        const miles = haversineMiles(origin, { lat: c.lat, lng: c.lng });
        if (miles < nearestMiles) {
          nearestMiles = miles;
          nearestSlug = c.slug;
        }
      }
      if (nearestSlug) return nearestSlug;
    }
  }

  const cookieStore = await cookies();
  const cookieCity = cookieStore.get(GEO_COOKIE)?.value;
  if (cookieCity && liveSlugs.has(cookieCity)) return cookieCity;

  return "tampa";
}

export default async function DiscoveryPage({
  searchParams,
}: {
  searchParams: Promise<{ city?: string }>;
}) {
  const client = await getServerClient();
  const { city: cityParam } = await searchParams;
  const cities = await fetchCities(client);
  const citySlug = await resolveCitySlug(cities, cityParam);
  const { city, gyms } = await fetchCityGyms(client, citySlug);

  if (!city) {
    return (
      <div className="mx-auto max-w-xl px-6 py-24 text-center">
        <h1 className="display text-3xl text-ink">No territory mapped yet</h1>
        <p className="mt-3 text-sm text-ink/70">
          The Tampa dataset hasn&apos;t been seeded. Run{" "}
          <code className="font-mono rounded bg-paper-raise px-1.5 py-0.5 text-xs">
            node scripts/seed.mjs
          </code>{" "}
          and reload.
        </p>
      </div>
    );
  }

  return <DiscoveryClient city={city} gyms={gyms} />;
}
