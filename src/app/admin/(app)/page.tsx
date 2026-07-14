import { notFound } from "next/navigation";
import { getStaff } from "@/lib/admin/auth";
import { getDashboardMetrics } from "@/lib/admin/metrics";
import { PageHeader, StatTile, Panel } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Dashboard · Scout Admin" };

function fmt(n: number | null): string {
  return n === null ? "—" : String(n);
}

/** Zero-states must be honest: null (query failed) ≠ 0 (queue clear) ≠ N
 *  (needs attention). Never render a bare "—" or "0" without saying why. */
function attentionTile(n: number | null, zeroLabel: string, activeLabel: string) {
  if (n === null) return { tone: "neutral" as const, sub: "unavailable" };
  if (n === 0) return { tone: "good" as const, sub: zeroLabel };
  return { tone: "warn" as const, sub: activeLabel };
}

export default async function AdminDashboard() {
  // This page fetches metrics via the RLS-bypassing service client, so it must
  // not rely on the parent layout's gate alone — enforce staff here too.
  const staff = await getStaff();
  if (!staff) notFound();
  const m = await getDashboardMetrics();
  // Never fabricate a combined total from a partial failure — null propagates.
  const flagged =
    m.reviewsReported === null || m.reviewsHidden === null ? null : m.reviewsReported + m.reviewsHidden;

  const ownerTile = attentionTile(m.submissionsPending, "Queue clear", "pending review");
  const flaggedTile = attentionTile(flagged, "No flags", "reported or hidden");
  const conflictTile = attentionTile(m.submissionsConflicted, "No conflicts", "owner facts conflict");
  const suspectTile = attentionTile(m.suspectGyms, "No alerts", "flagged suspect");

  return (
    <>
      <PageHeader
        title="Dashboard"
        description={`Signed in as ${staff?.email ?? "staff"} · operator control surface`}
      />

      <h2 className="readout mb-2 text-[11px] uppercase tracking-widest text-mist">Needs attention</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile
          label="Owner Submissions"
          value={fmt(m.submissionsPending)}
          sub={ownerTile.sub}
          tone={ownerTile.tone}
          href="/admin/owner-queue"
        />
        <StatTile
          label="Flagged Reviews"
          value={fmt(flagged)}
          sub={flaggedTile.sub}
          tone={flaggedTile.tone}
          href="/admin/moderation"
        />
        <StatTile
          label="Fact Corrections"
          value={fmt(m.submissionsConflicted)}
          sub={conflictTile.sub}
          tone={conflictTile.tone}
          href="/admin/owner-queue"
        />
        <StatTile
          label="Data Quality Alerts"
          value={fmt(m.suspectGyms)}
          sub={suspectTile.sub}
          tone={suspectTile.tone}
          href="/admin/gyms"
        />
      </div>

      <h2 className="readout mb-2 mt-6 text-[11px] uppercase tracking-widest text-mist">Catalog</h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <StatTile label="Gyms" value={fmt(m.gyms)} sub="across all metros" tone="good" href="/admin/gyms" />
        <StatTile label="Metros" value={fmt(m.cities)} sub="live + basic tier" tone="info" href="/admin/metros" />
        <StatTile label="Staff" value={fmt(m.staff)} sub="with portal access" tone="neutral" href="/admin/access" />
        <StatTile
          label="Audit Events"
          value={fmt(m.auditRecent)}
          sub="logged actions"
          tone="neutral"
          href="/admin/audit"
        />
      </div>

      <Panel title="Operator notes" className="mt-6 p-4">
        <ul className="flex flex-col gap-2 text-sm text-mist">
          <li>
            <span className="font-medium text-ink">Catalog &amp; data quality</span> — edit gyms, fix provenance,
            and add new locations under <span className="text-pool-deep">Gyms</span>.
          </li>
          <li>
            <span className="font-medium text-ink">Owner submissions</span> — the human gate that publishes owner-tier
            facts. The backend is live and the flow is verified end-to-end against <em>The Sauna Guys</em> and{" "}
            <em>NOEQL Training Co.</em>
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
