import { cache } from "react";
import { getServerClient } from "@/lib/supabase/server";
import { fetchCityGymCards } from "@/lib/queries/gyms";

/**
 * Request-deduped browse fetch for the city route (metadata + body share one
 * execution). Lives in its own module because it imports the cookie-bound
 * server client (next/headers) — gyms.ts is also bundled into client
 * components (ShortlistDrawer et al.) and must stay server-import-free.
 */
export const fetchCityGymCardsCached = cache(async (citySlug: string) => {
  const client = await getServerClient();
  return fetchCityGymCards(client, citySlug);
});
