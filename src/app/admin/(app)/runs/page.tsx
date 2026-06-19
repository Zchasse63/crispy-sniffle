import { PageHeader } from "@/components/admin/ui";
import { DeferredPanel } from "@/components/admin/DeferredPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pipeline Runs · Scout Admin" };

export default function RunsPage() {
  return (
    <>
      <PageHeader title="Pipeline Runs" description="Discovery → fetch → extract job history and cost ledger." />
      <DeferredPanel
        reason="The metro data pipeline is still driven by the local loader scripts (scripts/*.mjs: seed → enrich → geocode → …). The in-portal run buttons, candidate review grid, and cost ledger land once those scripts are wired as callable jobs."
        gate="Build as each loader script becomes a callable job (pipeline_runs + facility_candidates + pipeline_cost_ledger tables)."
      />
    </>
  );
}
