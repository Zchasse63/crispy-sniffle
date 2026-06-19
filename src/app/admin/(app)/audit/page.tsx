import { getServerClient } from "@/lib/supabase/server";
import { getAuditLog } from "@/lib/admin/system";
import { PageHeader, Panel, EmptyState } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Audit · Scout Admin" };

export default async function AuditPage() {
  const client = await getServerClient();
  const entries = await getAuditLog(client, 150);

  return (
    <>
      <PageHeader title="Audit Log" description="Every operator mutation, append-only. The trust backbone." />
      {entries.length === 0 ? (
        <Panel>
          <EmptyState title="No audit entries yet" hint="Mutations across the portal record an append-only row here." />
        </Panel>
      ) : (
        <Panel>
          <ul className="divide-y divide-paper-line/60">
            {entries.map((e) => (
              <li key={e.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-sm">
                <code className="rounded bg-paper px-1.5 py-0.5 text-xs text-pool-deep">{e.action}</code>
                {e.targetTable && (
                  <span className="text-xs text-mist">
                    {e.targetTable}
                    {e.targetId ? `/${e.targetId.slice(0, 8)}` : ""}
                  </span>
                )}
                {e.detail != null && (
                  <span className="min-w-0 flex-1 truncate text-xs text-mist">{JSON.stringify(e.detail)}</span>
                )}
                <span className="ml-auto text-xs text-mist">{e.actorEmail ?? "—"}</span>
                <time className="text-xs text-mist">{new Date(e.createdAt).toLocaleString()}</time>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
