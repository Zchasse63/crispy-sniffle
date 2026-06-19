import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import { getDataQuality } from "@/lib/admin/gyms-admin";
import { PageHeader, Panel, StatTile, ProvenancePill } from "@/components/admin/ui";
import { GYM_STATUS_LABELS } from "@/lib/types/scout";
import type { ProvenanceSource } from "@/lib/types/scout";

export const dynamic = "force-dynamic";
export const metadata = { title: "Data Quality · Scout Admin" };

export default async function DataQualityPage() {
  const client = await getServerClient();
  const dq = await getDataQuality(client);
  const totalFacts = dq.provenanceMix.reduce((s, p) => s + p.count, 0);

  return (
    <>
      <PageHeader title="Data Quality" description="Provenance, coverage gaps, and freshness across the catalog." />

      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Gyms" value={dq.totalGyms} tone="info" href="/admin/gyms" />
        <StatTile
          label="Low-confidence facts"
          value={dq.lowConfidenceFacts}
          sub="< 0.70 confidence"
          tone={dq.lowConfidenceFacts > 0 ? "warn" : "good"}
        />
        <StatTile
          label="Price gaps"
          value={dq.priceGapGyms.length}
          sub="no price signal"
          tone={dq.priceGapGyms.length > 0 ? "warn" : "good"}
        />
        <StatTile
          label="Stale"
          value={dq.staleGyms}
          sub="never/old fetch"
          tone={dq.staleGyms > 0 ? "neutral" : "good"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Provenance mix" className="p-4">
          {totalFacts === 0 ? (
            <p className="text-sm text-mist">No per-fact provenance recorded yet.</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {dq.provenanceMix.map((p) => (
                <li key={p.source} className="flex items-center gap-2">
                  <div className="w-28 shrink-0">
                    <ProvenancePill source={p.source as ProvenanceSource} />
                  </div>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-paper-line">
                    <div
                      className="h-full bg-pool"
                      style={{ width: `${Math.round((p.count / totalFacts) * 100)}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs tabular-nums text-mist">
                    {p.count} ({Math.round((p.count / totalFacts) * 100)}%)
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Lifecycle status" className="p-4">
          <ul className="flex flex-col gap-2">
            {dq.statusMix.map((s) => (
              <li key={s.status} className="flex items-center justify-between text-sm">
                <span className="text-ink">{GYM_STATUS_LABELS[s.status]}</span>
                <span className="tabular-nums text-mist">{s.count}</span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <Panel title="City coverage" className="mt-4">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-paper-line text-left">
                <th className="px-4 py-2 readout text-[11px] uppercase tracking-wider text-mist">Metro</th>
                <th className="px-4 py-2 readout text-[11px] uppercase tracking-wider text-mist">Gyms</th>
                <th className="px-4 py-2 readout text-[11px] uppercase tracking-wider text-mist">Avg complete</th>
                <th className="px-4 py-2 readout text-[11px] uppercase tracking-wider text-mist">Price gaps</th>
              </tr>
            </thead>
            <tbody>
              {dq.cityBoard.map((c) => (
                <tr key={c.cityId} className="border-b border-paper-line/60 last:border-0">
                  <td className="px-4 py-2 text-ink">
                    {c.name ?? "—"}
                    {c.state ? `, ${c.state}` : ""}
                  </td>
                  <td className="px-4 py-2 tabular-nums text-mist">{c.gyms}</td>
                  <td className="px-4 py-2 tabular-nums text-mist">{c.avgCompleteness}%</td>
                  <td className="px-4 py-2 tabular-nums text-mist">{c.priceGaps}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      {dq.priceGapGyms.length > 0 && (
        <Panel title={`Price-gap queue (${dq.priceGapGyms.length})`} className="mt-4 p-4">
          <ul className="flex flex-wrap gap-2">
            {dq.priceGapGyms.map((g) => (
              <li key={g.id}>
                <Link
                  href={`/admin/gyms/${g.id}`}
                  className="inline-flex items-center gap-1.5 rounded-md border border-paper-line px-2.5 py-1 text-xs text-ink transition-colors hover:border-pool/40"
                >
                  {g.name}
                  {g.cityName && <span className="text-mist">· {g.cityName}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
