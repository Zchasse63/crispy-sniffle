import { PageHeader } from "@/components/admin/ui";
import { DeferredPanel } from "@/components/admin/DeferredPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Revenue · Scout Admin" };

export default function AdminRevenuePage() {
  return (
    <>
      <PageHeader
        title="Monetization"
        description="Scout+ subscriptions (B2C floor) and Partner SaaS (B2B ceiling) — never a take-rate."
      />
      <DeferredPanel
        reason="Billing is gated on a measured consumer loop. Scout+ ships before Partner; neither charges before the loop clears PLAN's beta-success thresholds. The UI must forbid Partner-before-Scout+, charging-before-the-gate, and any take-rate field by construction."
        gate="Enters when the measured loop clears beta-success thresholds (the whole point of the deferred analytics work)."
      />
    </>
  );
}
