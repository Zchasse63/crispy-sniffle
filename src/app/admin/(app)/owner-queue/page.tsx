import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import { listSubmissions } from "@/lib/admin/submissions";
import { PageHeader, Panel, Pill, EmptyState, ActionLink } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Owner Queue · Scout Admin" };

const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "neutral" | "info"> = {
  pending: "warn",
  needs_info: "info",
  published: "good",
  rejected: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending",
  needs_info: "Needs info",
  published: "Published",
  rejected: "Rejected",
};

export default async function OwnerQueuePage() {
  const client = await getServerClient();
  const subs = await listSubmissions(client);
  const pending = subs.filter((s) => s.status === "pending" || s.status === "needs_info").length;

  return (
    <>
      <PageHeader
        title="Owner Queue"
        description={`${pending} awaiting review · ${subs.length} total`}
        actions={<ActionLink href="/admin/invites" variant="ghost">Manage invites</ActionLink>}
      />

      {subs.length === 0 ? (
        <Panel>
          <EmptyState
            title="No owner submissions yet"
            hint="Mint an invite for a gym, send the link to the owner, and their confirmed listing lands here for review before it publishes."
          />
        </Panel>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-paper-line">
          <table className="w-full min-w-[680px] text-sm">
            <thead>
              <tr className="border-b border-paper-line bg-paper-raise text-left">
                {["Gym", "Contact", "Facts", "Conflicts", "Status", "Received"].map((h) => (
                  <th key={h} className="px-3 py-2 readout text-[11px] uppercase tracking-wider text-mist">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {subs.map((s) => (
                <tr key={s.id} className="border-b border-paper-line/60 last:border-0 hover:bg-paper-raise/50">
                  <td className="px-3 py-2">
                    <Link href={`/admin/owner-queue/${s.id}`} className="font-medium text-ink hover:text-pool-deep">
                      {s.gymName ?? "Unknown gym"}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-mist">
                    {s.contactName ?? "—"}
                    {s.contactRole ? <span className="text-mist/70"> · {s.contactRole}</span> : null}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-mist">{s.factCount}</td>
                  <td className="px-3 py-2">
                    {s.conflictCount > 0 ? (
                      <Pill tone="warn">{s.conflictCount}</Pill>
                    ) : (
                      <span className="text-mist">0</span>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <Pill tone={STATUS_TONE[s.status] ?? "neutral"}>{STATUS_LABEL[s.status] ?? s.status}</Pill>
                  </td>
                  <td className="px-3 py-2 text-mist">{new Date(s.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
