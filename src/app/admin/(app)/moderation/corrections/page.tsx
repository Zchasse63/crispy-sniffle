import { notFound } from "next/navigation";
import Link from "next/link";
import { getStaff } from "@/lib/admin/auth";
import { getServiceClient } from "@/lib/admin/service";
import { listCorrections, type CorrectionRow } from "@/lib/admin/moderation";
import { PageHeader, Panel, EmptyState } from "@/components/admin/ui";
import { AMENITY_LABELS, EQUIPMENT_LABELS, type AmenityKey, type EquipmentKey } from "@/lib/types/scout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Corrections · Scout Admin" };

function factLabel(factType: string, factKey: string): string {
  if (factType === "amenity") return AMENITY_LABELS[factKey as AmenityKey] ?? factKey;
  if (factType === "equipment") return EQUIPMENT_LABELS[factKey as EquipmentKey] ?? factKey;
  if (factType === "price" && factKey === "day_pass") return "Day pass price";
  if (factType === "hours" && factKey === "hours") return "Hours";
  return factKey;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/** Group corrections by gym, most-recently-corrected gym first — rows within
 *  a group stay in the query's updated_at-desc order. */
function groupByGym(rows: CorrectionRow[]): { gymId: string; gymName: string | null; rows: CorrectionRow[] }[] {
  const order: string[] = [];
  const groups = new Map<string, CorrectionRow[]>();
  for (const r of rows) {
    if (!groups.has(r.gymId)) {
      order.push(r.gymId);
      groups.set(r.gymId, []);
    }
    groups.get(r.gymId)!.push(r);
  }
  return order.map((gymId) => ({ gymId, gymName: groups.get(gymId)![0].gymName, rows: groups.get(gymId)! }));
}

export default async function CorrectionsQueuePage() {
  // This page fetches via the RLS-bypassing service client (fact_confirmations
  // RLS scopes rows to auth.uid() = user_id, so no session client can list
  // every member's corrections) — enforce staff here too, not just via the
  // parent layout gate, same pattern as the dashboard.
  const staff = await getStaff();
  if (!staff) notFound();
  const service = getServiceClient();
  const corrections = await listCorrections(service);
  const groups = groupByGym(corrections);

  return (
    <>
      <PageHeader
        title="Corrections"
        description="Member-suggested corrections to gym facts (fact_confirmations, verdict = 'correct'), newest first."
      />

      <Panel className="mb-4 p-4">
        <p className="text-xs leading-relaxed text-mist">
          <b className="text-ink">v1 is read-only.</b> This queue surfaces what members flagged as wrong — it
          doesn&apos;t accept or reject anything yet. To act on a correction, open the gym in the inspector and edit
          the field directly; there&apos;s no one-click apply here yet.
        </p>
      </Panel>

      {groups.length === 0 ? (
        <Panel>
          <EmptyState title="No corrections yet" hint="Member-suggested corrections will show up here as they come in." />
        </Panel>
      ) : (
        <div className="flex flex-col gap-4">
          {groups.map((g) => (
            <Panel
              key={g.gymId}
              title={`${g.gymName ?? "Unknown gym"} (${g.rows.length})`}
              actions={
                <Link
                  href={`/admin/gyms/${g.gymId}`}
                  className="text-xs font-medium text-pool-deep transition-colors hover:text-ink"
                >
                  Open in inspector →
                </Link>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-sm">
                  <thead>
                    <tr className="border-b border-paper-line text-left">
                      <th className="px-4 py-2 readout text-[11px] uppercase tracking-wider text-mist">Fact</th>
                      <th className="px-4 py-2 readout text-[11px] uppercase tracking-wider text-mist">
                        Suggested value
                      </th>
                      <th className="px-4 py-2 readout text-[11px] uppercase tracking-wider text-mist">Note</th>
                      <th className="px-4 py-2 readout text-[11px] uppercase tracking-wider text-mist">Reported</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.id} className="border-b border-paper-line/60 last:border-0">
                        <td className="px-4 py-2 text-ink">{factLabel(r.factType, r.factKey)}</td>
                        <td className="px-4 py-2 text-ink">{r.correctedValue ?? <span className="text-mist">—</span>}</td>
                        <td className="px-4 py-2 text-mist">{r.note ?? "—"}</td>
                        <td className="px-4 py-2 tabular-nums text-mist">{fmtDate(r.updatedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          ))}
        </div>
      )}
    </>
  );
}
