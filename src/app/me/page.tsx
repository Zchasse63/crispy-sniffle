import type { Metadata } from "next";
import { getServerClient } from "@/lib/supabase/server";
import { fetchCityGyms } from "@/lib/queries/gyms";
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
  // gym lookup for visit log + nudges (Tampa beta scope)
  const { gyms } = await fetchCityGyms(client, "tampa");
  return <ProfilePortal serverUser={user ? { id: user.id, email: user.email ?? "" } : null} gyms={gyms} />;
}
