import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { fetchGymsByIds } from "@/lib/queries/gyms";
import { ProfilePortal } from "@/components/profile/ProfilePortal";

export const metadata: Metadata = {
  title: "Your Scout — visits, saves, trips",
};
export const dynamic = "force-dynamic";

export default async function MePage() {
  const client = await getServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return <ProfilePortal serverUser={null} gyms={[]} />;
  }

  // Gym lookup for the visit log + saved/followed sections — union of every
  // LIVE city. A Tampa-only fetchCityGyms() here made Miami visits/follows
  // silently vanish (their gym ids just weren't in the lookup map) once
  // Miami gyms existed; resolve the IDS this user actually referenced
  // instead of scanning one city's whole catalog.
  const [{ data: visitRows }, { data: followRows }] = await Promise.all([
    client.from("gym_visits").select("gym_id").eq("user_id", user.id),
    client.from("followed_gyms").select("gym_id").eq("user_id", user.id),
  ]);
  const gymIds = [
    ...new Set([...(visitRows ?? []), ...(followRows ?? [])].map((r) => r.gym_id)),
  ];
  const gyms = await fetchGymsByIds(client, gymIds);

  return (
    <ProfilePortal
      serverUser={{ id: user.id, email: user.email ?? "" }}
      gyms={gyms}
    />
  );
}
