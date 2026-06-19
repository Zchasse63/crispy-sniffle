import Link from "next/link";
import { getServerClient } from "@/lib/supabase/server";
import { listMetros } from "@/lib/admin/metros";
import { PageHeader, Pill } from "@/components/admin/ui";
import { AddMetroForm, TierToggle } from "@/components/admin/MetroControls";

export const dynamic = "force-dynamic";
export const metadata = { title: "Metros · Scout Admin" };

export default async function MetrosPage() {
  const client = await getServerClient();
  const metros = await listMetros(client);
  const totalGyms = metros.reduce((s, m) => s + m.gymCount, 0);

  return (
    <>
      <PageHeader
        title="Metros & Pipeline"
        description={`${metros.length} metros · ${totalGyms} gyms`}
        actions={<AddMetroForm />}
      />

      <div className="overflow-x-auto rounded-xl border border-paper-line">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="border-b border-paper-line bg-paper-raise text-left">
              {["Metro", "Tier", "Gyms", "Verified", "Avg complete", "Price gaps", ""].map((h, i) => (
                <th key={i} className="px-3 py-2 readout text-[11px] uppercase tracking-wider text-mist">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metros.map((m) => (
              <tr key={m.id} className="border-b border-paper-line/60 last:border-0 hover:bg-paper-raise/50">
                <td className="px-3 py-2">
                  <Link href={`/admin/metros/${m.id}`} className="font-medium text-ink hover:text-pool-deep">
                    {m.name}
                  </Link>
                  <span className="text-mist">, {m.state}</span>
                </td>
                <td className="px-3 py-2">
                  <Pill tone={m.tier === "rich" ? "good" : "neutral"}>{m.tier}</Pill>
                </td>
                <td className="px-3 py-2 tabular-nums text-mist">{m.gymCount}</td>
                <td className="px-3 py-2 tabular-nums text-mist">{m.verified}</td>
                <td className="px-3 py-2 tabular-nums text-mist">{m.avgCompleteness}%</td>
                <td className="px-3 py-2 tabular-nums">
                  {m.priceGaps > 0 ? <span className="text-blaze-deep">{m.priceGaps}</span> : <span className="text-mist">0</span>}
                </td>
                <td className="px-3 py-2 text-right">
                  <TierToggle id={m.id} tier={m.tier} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 text-xs text-mist">
        Pipeline run controls (discovery / fetch / extract) are gated on the loader scripts landing — see{" "}
        <Link href="/admin/runs" className="text-pool-deep hover:underline">
          Pipeline Runs
        </Link>
        .
      </p>
    </>
  );
}
