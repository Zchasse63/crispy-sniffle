import { PageHeader } from "@/components/admin/ui";
import { DeferredPanel } from "@/components/admin/DeferredPanel";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analytics · Scout Admin" };

export default function AdminAnalyticsPage() {
  return (
    <>
      <PageHeader
        title="Growth & Analytics"
        description="Loop pulse, retention, search intelligence, funnels, demand."
      />
      <DeferredPanel
        reason="Analytics instrumentation is the final pre-launch step. With no live traffic yet, there is no auth-less loop data being lost — so the spec's “instrument now or lose it” urgency does not apply until launch is imminent."
        gate="Build last, immediately before the first real users arrive — alongside the chosen analytics tool (PostHog vs Plausible) + the analytics_events first-party spine."
      />
    </>
  );
}
