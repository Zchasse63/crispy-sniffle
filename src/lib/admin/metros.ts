import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types/database";
import { listGymsForAdmin, type AdminGymRow } from "@/lib/admin/gyms-admin";

type Client = SupabaseClient<Database>;

export interface MetroRow {
  id: string;
  slug: string;
  name: string;
  state: string;
  tier: string;
  gymCount: number;
  avgCompleteness: number;
  priceGaps: number;
  verified: number;
}

export async function listMetros(client: Client): Promise<MetroRow[]> {
  const [gyms, citiesRes] = await Promise.all([
    listGymsForAdmin(client),
    client.from("cities").select("id, slug, name, state, tier").order("name"),
  ]);
  const byCity = new Map<string, AdminGymRow[]>();
  for (const g of gyms) {
    const list = byCity.get(g.cityId) ?? [];
    list.push(g);
    byCity.set(g.cityId, list);
  }
  return (citiesRes.data ?? []).map((c) => {
    const list = byCity.get(c.id) ?? [];
    const avg = list.length
      ? Math.round(list.reduce((s, g) => s + g.completeness, 0) / list.length)
      : 0;
    return {
      id: c.id,
      slug: c.slug,
      name: c.name,
      state: c.state,
      tier: c.tier,
      gymCount: list.length,
      avgCompleteness: avg,
      priceGaps: list.filter((g) => !g.hasPrice).length,
      verified: list.filter((g) => g.verified).length,
    };
  });
}

export interface MetroDetail {
  id: string;
  slug: string;
  name: string;
  state: string;
  tier: string;
  lat: number;
  lng: number;
  gyms: AdminGymRow[];
}

export async function getMetro(client: Client, id: string): Promise<MetroDetail | null> {
  const { data: city, error } = await client
    .from("cities")
    .select("id, slug, name, state, tier, lat, lng")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!city) return null;
  const gyms = (await listGymsForAdmin(client)).filter((g) => g.cityId === id);
  return {
    id: city.id,
    slug: city.slug,
    name: city.name,
    state: city.state,
    tier: city.tier,
    lat: Number(city.lat),
    lng: Number(city.lng),
    gyms,
  };
}
