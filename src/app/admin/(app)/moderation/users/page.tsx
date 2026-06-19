import { getServerClient } from "@/lib/supabase/server";
import { listBannedUsers } from "@/lib/admin/moderation";
import { PageHeader, Panel, EmptyState } from "@/components/admin/ui";
import { UnbanButton } from "@/components/admin/UnbanButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Banned Users · Scout Admin" };

export default async function BannedUsersPage() {
  const client = await getServerClient();
  const banned = await listBannedUsers(client);

  // Resolve emails via the staff-only lookup RPC (auth.users is never exposed).
  const withEmail = await Promise.all(
    banned.map(async (u) => {
      const { data: email } = await client.rpc("admin_user_lookup", { uid: u.userId });
      return { ...u, email: (email as string | null) ?? null };
    }),
  );

  return (
    <>
      <PageHeader title="Banned Users" description="Banned users cannot post reviews; their existing reviews are hidden." />
      {withEmail.length === 0 ? (
        <Panel>
          <EmptyState title="No banned users" hint="Ban a user from the review queue's “Ban author” action." />
        </Panel>
      ) : (
        <Panel>
          <ul className="divide-y divide-paper-line/60">
            {withEmail.map((u) => (
              <li key={u.userId} className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm text-ink">{u.email ?? u.userId}</p>
                  {u.reason && <p className="text-xs text-mist">Reason: {u.reason}</p>}
                  <p className="text-xs text-mist">Banned {new Date(u.createdAt).toLocaleDateString()}</p>
                </div>
                <UnbanButton userId={u.userId} />
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
