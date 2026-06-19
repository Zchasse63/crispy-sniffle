import { getStaff } from "@/lib/admin/auth";
import { getDashboardMetrics } from "@/lib/admin/metrics";
import { PageHeader, StatTile, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · Scout Admin" };

function fmt(n: number | null): string {
  return n === null ? "—" : String(n);
}

export default async function AdminDashboard() {
  const staff = await getStaff();
  const m = await getDashboardMetrics();
  const flagged = (m.reviewsReported ?? 0) + (m.reviewsHidden ?? 0);

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${staff?.email ?? "staff"} · operator control surface`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Gyms" value={fmt(m.gyms)} sub="across all metros" tone="good" href="/admin/gyms" />
        <StatTile label="Metros" value={fmt(m.cities)} sub="live + basic tier" tone="info" href="/admin/metros" />
        <StatTile
          label="Owner Queue"
          value={fmt(m.submissionsPending)}
          sub={m.submissionsPending === null ? "backend pending" : "pending review"}
          tone={m.submissionsPending && m.submissionsPending > 0 ? "warn" : "neutral"}
          href="/admin/owner-queue"
        />
        <StatTile
          label="Flagged Reviews"
          value={String(flagged)}
          sub="reported or hidden"
          tone={flagged > 0 ? "warn" : "neutral"}
          href="/admin/moderation"
        />
        <StatTile label="Staff" value={fmt(m.staff)} sub="with portal access" tone="neutral" href="/admin/access" />
        <StatTile
          label="Audit Events"
          value={fmt(m.auditRecent)}
          sub="logged actions"
          tone="neutral"
          href="/admin/audit"
        />
        <StatTile label="Analytics" value="—" sub="instrument pre-launch" tone="neutral" href="/admin/analytics" />
        <StatTile label="Revenue" value="—" sub="gated on loop" tone="neutral" href="/admin/revenue" />
      </div>

      <Panel title="Operator notes" className="mt-6 p-4">
        <ul className="flex flex-col gap-2 text-sm text-mist">
          <li>
            <span className="font-medium text-ink">Catalog &amp; data quality</span> — edit gyms, fix provenance,
            and add new locations under <span className="text-pool-deep">Gyms</span>.
          </li>
          <li>
            <span className="font-medium text-ink">Owner submissions</span> — the human gate that publishes owner-tier
            facts. The trial run targets <em>The Sauna Guys</em> and <em>NOEQL</em> once the backend is live.
          </li>
          <li>
            <span className="font-medium text-ink">Analytics &amp; revenue</span> are deliberately deferred — they
            instrument as the final pre-launch step, not now (no live traffic yet).
          </li>
        </ul>
      </Panel>
    </>
  );
}
