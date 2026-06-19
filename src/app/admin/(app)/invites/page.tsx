import { getServerClient } from "@/lib/supabase/server";
import { listInvites } from "@/lib/admin/submissions";
import { listGymsForAdmin } from "@/lib/admin/gyms-admin";
import { PageHeader } from "@/components/admin/ui";
import { InviteManager } from "@/components/admin/InviteManager";

export const dynamic = "force-dynamic";
export const metadata = { title: "Invites · Scout Admin" };

export default async function InvitesPage() {
  const client = await getServerClient();
  const [invites, gyms] = await Promise.all([listInvites(client), listGymsForAdmin(client)]);

  return (
    <>
      <PageHeader
        title="Owner Invites"
        description="Mint a tokenized link for a gym owner. The link is shown once; only its hash is stored."
      />
      <InviteManager
        gyms={gyms.map((g) => ({ id: g.id, name: g.name, cityName: g.cityName }))}
        invites={invites}
      />
    </>
  );
}
