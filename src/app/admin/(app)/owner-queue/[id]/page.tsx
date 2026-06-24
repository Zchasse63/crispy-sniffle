import { notFound } from "next/navigation";
import { getServerClient } from "@/lib/supabase/server";
import { getSubmission } from "@/lib/admin/submissions";
import { PageHeader, Panel, Pill, ActionLink } from "@/components/admin/ui";
import { SubmissionReview } from "@/components/admin/SubmissionReview";
import { ExternalLink } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_TONE: Record<string, "good" | "warn" | "bad" | "neutral" | "info"> = {
  pending: "warn",
  needs_info: "info",
  published: "good",
  rejected: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Pending review",
  needs_info: "Needs info",
  published: "Published",
  rejected: "Rejected",
};

export default async function SubmissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const client = await getServerClient();
  const sub = await getSubmission(client, id);
  if (!sub) notFound();

  const actionable = sub.status === "pending" || sub.status === "needs_info";

  return (
    <>
      <PageHeader
        title={sub.gymName ?? "Owner submission"}
        description={`From ${sub.contactName ?? "an owner"}${sub.contactRole ? ` (${sub.contactRole})` : ""} · ${new Date(
          sub.createdAt,
        ).toLocaleString()}`}
        actions={
          <ActionLink href={`/admin/gyms/${sub.gymId}`} variant="ghost">
            <ExternalLink className="h-4 w-4" /> Inspector
          </ActionLink>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        <Pill tone={STATUS_TONE[sub.status] ?? "neutral"}>{STATUS_LABEL[sub.status] ?? sub.status}</Pill>
        {sub.revision > 1 && <Pill tone="info">Revision {sub.revision}</Pill>}
        {sub.contactEmail && <span className="text-xs text-mist">{sub.contactEmail}</span>}
      </div>

      {sub.note && (
        <Panel title="Owner note" className="mb-4 p-4">
          <p className="text-sm text-ink">{sub.note}</p>
        </Panel>
      )}

      {sub.reviewNote && (
        <Panel title="Review note" className="mb-4 p-4">
          <p className="text-sm text-ink">{sub.reviewNote}</p>
        </Panel>
      )}

      <SubmissionReview submissionId={sub.id} facts={sub.facts} actionable={actionable} />
    </>
  );
}
